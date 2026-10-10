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
      const types = read('src/pages/pos/types.ts');
      expect(types).toMatch(/sans:\s*'var\(--font-sans,\s*system-ui/);
      expect(types).toMatch(/mono:\s*'var\(--font-mono,\s*ui-monospace/);
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
      expect(read(INDEX_CSS)).toMatch(/body\s*\{[^}]*font-family:\s*var\(--font-sans\)/);
    });

    it('never hardcodes a font family on the body', () => {
      // The body must take its stack from the custom property, so *any*
      // other value on `font-family` is a regression. Matching the value
      // rather than a quote character is what makes this hold for double
      // quotes and for spacing before the colon: the previous form only
      // rejected a single-quoted literal sitting right after the colon.
      const css = read(INDEX_CSS);
      const bodyRule = /body\s*\{([^}]*)\}/.exec(css)?.[1];
      expect(bodyRule).toBeDefined();

      const families = [...(bodyRule ?? '').matchAll(/font-family\s*:\s*([^;]+);/g)]
        .map(([, value]) => (value ?? '').trim())
        .filter((value) => value.length > 0);

      // Non-vacuity: the body does declare a family, so a hardcoded one
      // would be caught rather than skipped.
      expect(families.length).toBeGreaterThan(0);
      expect(families.filter((value) => !value.startsWith('var(--font-sans'))).toEqual([]);
    });
  });

  describe('pages/pos/styles.ts', () => {
    it('no longer exists', () => {
      expect(existsSync(fixturePath(DEAD_STYLES_MODULE))).toBe(false);
    });
  });
});