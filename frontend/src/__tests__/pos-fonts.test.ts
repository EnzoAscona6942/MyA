// ============================================================
// POS - WEBFONTS AND ANIMATIONS (structural regression)
// ============================================================
//
// `jsdom` does not load webfonts and does not evaluate animation
// names, so there is no runnable test for "the font renders".
// These assertions read the shipped files from disk and guard two
// exact regressions: the font and the `@keyframes` living only inside
// a never-called `initStyles()`, and the POS depending on a
// third-party origin for first paint instead of vendored binaries.

import { existsSync, readFileSync } from 'node:fs';

import { fixturePath, readFixture } from './posTestRoot';

// Fixture paths resolve against the package root located by the harness,
// not against `process.cwd()`: a runner started from the monorepo root
// used to turn every assertion below into an ENOENT.
const read = readFixture;

const INDEX_HTML = 'index.html';
const INDEX_CSS = 'src/index.css';
const POS_STYLESHEET = 'src/pages/pos/pos.css';
const DEAD_STYLES_MODULE = 'src/pages/pos/styles.ts';
const PUBLIC_FONTS = 'public/fonts';

// Sora ships as a variable font: Google serves one identical binary for every
// weight, so it is vendored once and declared over the full range. DM Mono is
// static and needs one file per weight. Sora 300 is intentionally not vendored.
const FONT_FILES = [
  { file: 'sora-var.woff2', family: 'Sora', weight: '100 800' },
  { file: 'dm-mono-400.woff2', family: 'DM Mono', weight: 400 },
  { file: 'dm-mono-500.woff2', family: 'DM Mono', weight: 500 }
] as const;

// The `body` element rule, read off the stylesheet as a selector list.
//
// This is deliberately NOT `/body\s*\{([^}]*)\}/` with "first match wins".
// That pattern is unanchored on the left, so any earlier rule whose selector
// merely ends in the letters `body` — a `tbody` element, a `.card-body`
// utility class, a `#page-body` id — is read as the subject instead of the
// real one. A wrong rule declaring the token family while the real `body`
// rule carries a hardcoded literal then reads as a pass on exactly the
// regression this guard exists to catch.
//
// The selector is split on commas, and each part must BE `body`: no
// identifier character, hyphen, class or id may precede it, and nothing may
// follow it. `html body` and `.wrap > body` match because `body` is still the
// subject of that compound; `body.dark`, `tbody`, `.card-body` and
// `#page-body` do not.
const BODY_SELECTOR = /(?:^|[\s>+~])\s*body\s*$/;

// Every declaration block whose selector list targets the `body` element.
// Empty when the stylesheet declares no such rule, which the assertions
// below treat as a failure rather than as a pass.
const bodyRuleDeclarations = (css: string): string[] => {
  // Strip block comments first: a commented-out rule is not a rule, and
  // `@media { body { ... } }` bodies are reached by the same flat scan.
  const source = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector]) =>
      (selector ?? '')
        .split(',')
        .map((part) => part.trim())
        .some((part) => BODY_SELECTOR.test(part))
    )
    .map(([, , declarations]) => (declarations ?? '').trim());
};

// The `font-family` values declared by the `body` rule.
//
// The terminating semicolon is OPTIONAL so the last declaration in a rule is
// still captured. Requiring it made the guard's outcome depend on how the
// stylesheet happens to be serialised: a `body` rule whose `font-family` is
// final and unterminated yielded an empty list and the non-vacuity assertion
// failed for a purely formatting reason.
const bodyFamilyValues = (css: string): string[] =>
  bodyRuleDeclarations(css)
    .flatMap((declarations) => [...declarations.matchAll(/font-family\s*:\s*([^;}]+)/g)])
    .map(([, value]) => (value ?? '').trim())
    .filter((value) => value.length > 0);

// The only legitimate `body` value is the token plus its fallback list. The
// fallback must be unquoted: a quoted family name anywhere in the value is
// the literal class this guard rejects, and it used to slip through whenever
// the capture merely *began* with the token — as in
// `var(--font-sans), 'DM Mono', monospace`, where the capture spans the
// commas up to the next semicolon.
const QUOTED_FAMILY = /['"`]/;

const isSansTokenValue = (value: string): boolean =>
  value.startsWith('var(--font-sans') && !QUOTED_FAMILY.test(value);

// The `@font-face` block that declares `file`, or an empty string when the
// stylesheet never references it.
const fontFaceBlockFor = (css: string, file: string): string => {
  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  return blocks.find((block) => block.includes(`url('/fonts/${file}')`)) ?? '';
};

describe('POS webfonts and animations', () => {
  describe('index.html', () => {
    it('references no third-party font origin', () => {
      const html = read(INDEX_HTML);
      expect(html).not.toContain('fonts.googleapis.com');
      expect(html).not.toContain('fonts.gstatic.com');
    });

    it('blocks no first paint on a remote stylesheet', () => {
      expect(read(INDEX_HTML)).not.toMatch(/<link[^>]*rel="stylesheet"[^>]*href="https?:/);
    });
  });

  describe('self-hosted fonts', () => {
    it('declares an @font-face rule for both families', () => {
      const css = read(INDEX_CSS);
      expect(css).toMatch(/@font-face\s*\{[^}]*font-family:\s*'Sora'/);
      expect(css).toMatch(/@font-face\s*\{[^}]*font-family:\s*'DM Mono'/);
    });

    it('declares every vendored file with swap and a latin unicode-range', () => {
      const css = read(INDEX_CSS);
      for (const { file, family, weight } of FONT_FILES) {
        const block = fontFaceBlockFor(css, file);
        expect(block).toContain(`font-family: '${family}'`);
        expect(block).toContain(`font-weight: ${weight}`);
        expect(block).toContain('font-style: normal');
        expect(block).toContain('font-display: swap');
        expect(block).toMatch(/src:\s*url\('\/fonts\//);
        expect(block).toContain("format('woff2')");
        expect(block).toMatch(/unicode-range:\s*U\+0000-00FF/);
      }
    });

    it('vendors every woff2 file on disk with the wOF2 signature', () => {
      for (const { file } of FONT_FILES) {
        const path = fixturePath(PUBLIC_FONTS, file);
        expect(existsSync(path)).toBe(true);
        const bytes = readFileSync(path);
        expect(bytes.length).toBeGreaterThan(1000);
        expect([...bytes.subarray(0, 4)]).toEqual([0x77, 0x4f, 0x46, 0x32]);
      }
    });

    it('keeps the font role tokens declared with a fallback', () => {
      // The tokens moved to the shared theme module when the seven duplicated
      // palettes were collapsed. They are re-exported from `pos/types.ts`, so
      // a re-export alone would no longer prove the declarations exist.
      const theme = read('src/theme.ts');
      expect(theme).toMatch(/sans:\s*'var\(--font-sans,\s*system-ui/);
      expect(theme).toMatch(/mono:\s*'var\(--font-mono,\s*ui-monospace/);
    });
  });

  describe('pages/pos/pos.css', () => {
    it('declares every animation used by the POS components', () => {
      const css = read(POS_STYLESHEET);
      expect(css).toContain('@keyframes slideIn');
      expect(css).toContain('@keyframes fadeIn');
      expect(css).toContain('@keyframes scanPulse');
      // `flashGreen` is deliberately absent. It shipped with a
      // `.flash-green` class that no component ever applied: the
      // add-to-cart highlight is driven by `logic.flashId` with an inline
      // background on the cart row, so the keyframes animated nothing.
      expect(css).not.toContain('flashGreen');
    });

    it('declares the item-enter class and no dead flash-green class', () => {
      const css = read(POS_STYLESHEET);
      expect(css).toMatch(/\.item-enter\s*\{/);
      expect(css).not.toMatch(/\.flash-green\s*\{/);
    });
  });

  describe('index.css', () => {
    it('declares both font role custom properties', () => {
      const css = read(INDEX_CSS);
      expect(css).toMatch(/--font-sans:\s*'Sora'/);
      expect(css).toMatch(/--font-mono:\s*'DM+Mono'|--font-mono:\s*'DM Mono'/);
    });

    it('applies the sans stack to the body', () => {
      // Read through the anchored extractor rather than through a loose
      // `/body\s*\{/`, so this proves the *body element* takes the stack and
      // not whichever earlier rule happened to end in those letters.
      const values = bodyFamilyValues(read(INDEX_CSS));
      // Non-vacuity: the body rule was located and declares a family.
      expect(values.length).toBeGreaterThan(0);
      expect(values.some((value) => value.startsWith('var(--font-sans'))).toBe(true);
    });

    it('never hardcodes a font family on the body', () => {
      // The body must take its stack from the custom property, so *any*
      // other value on `font-family` is a regression. Matching the value
      // rather than a quote character is what makes this hold for double
      // quotes and for spacing before the colon: the previous form only
      // rejected a single-quoted literal sitting right after the colon.
      const css = read(INDEX_CSS);

      // Non-vacuity on two axes: the anchored extractor really found the
      // `body` element rule, and that rule really declares a family. A
      // broken selector or a broken value pattern must fail here rather
      // than read as a clean sweep.
      expect(bodyRuleDeclarations(css).length).toBeGreaterThan(0);

      const families = bodyFamilyValues(css);
      expect(families.length).toBeGreaterThan(0);
      // Legitimate value: the token, optionally followed by its own
      // unquoted fallback list. `var(--font-sans)` passes;
      // `var(--font-sans), 'DM Mono', monospace` does not, because the
      // quoted literal is a second source of truth even though the value
      // starts with the token.
      expect(families.filter((value) => !isSansTokenValue(value))).toEqual([]);
    });

    it('resolves the body element rule, not a selector ending in "body"', () => {
      // The anchoring itself, proven on a synthetic stylesheet, so a
      // regression that loosens the selector is caught here instead of
      // silently reading another rule in the real file.
      const decoy = (selector: string): string =>
        `${selector} { font-family: var(--font-sans); }`;

      // Rejected: the letters `body` inside a longer selector.
      for (const selector of ['tbody', '.card-body', '#page-body', 'body.dark', '.body']) {
        expect(bodyFamilyValues(`${decoy(selector)}\nbody { font-family: 'DM Mono'; }`)).toEqual([
          "'DM Mono'"
        ]);
      }

      // Accepted: `body` alone, after a combinator, or after a comma.
      for (const selector of ['body', 'html body', '.wrap > body', 'a, body']) {
        expect(bodyFamilyValues(`${decoy(selector)}`)).toEqual(['var(--font-sans)']);
      }
    });

    it('reads a font-family that ends the body rule without a trailing semicolon', () => {
      // The serialisation independence the optional terminator buys.
      const unterminated = 'body { color: var(--text); font-family: var(--font-sans) }';
      expect(bodyFamilyValues(unterminated)).toEqual(['var(--font-sans)']);

      // And the negative still bites when the value is the last declaration.
      expect(bodyFamilyValues("body { color: var(--text); font-family: 'DM Mono' }")).toEqual([
        "'DM Mono'"
      ]);
    });
  });

  describe('pages/pos/styles.ts', () => {
    it('no longer exists', () => {
      expect(existsSync(fixturePath(DEAD_STYLES_MODULE))).toBe(false);
    });
  });
});