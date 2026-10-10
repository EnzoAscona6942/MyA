// ============================================================
// POS - UI CONTRACTS (structural invariants)
// ============================================================
//
// `jsdom` renders nothing: it cannot measure a glyph, cannot resolve a
// CSS custom property and does not evaluate an animation name, so none of
// these contracts has a behavioural test. What it can do is read the
// source, and that is where the contracts live.
//
// Every negative assertion here is written so a broken extractor fails
// the suite instead of passing vacuously: each one first proves it
// actually found the declarations it is about to reject. A guard that
// silently stops matching is worse than no guard, because it reads as
// coverage.

import { existsSync } from 'node:fs';
import { fixturePath, frontendRoot, readFixture } from './posTestRoot';

const INDEX_CSS = 'src/index.css';
const POS_ENTRY = 'src/pages/POS.tsx';
const POS_STYLESHEET = 'src/pages/pos/pos.css';
const POS_TYPES = 'src/pages/pos/types.ts';
const POS_MODULES = ['src/pages/pos/render.tsx', 'src/pages/pos/components.tsx'] as const;

// ── Extractors ───────────────────────────────────────────────

// Style-object property values, up to the comma, semicolon, newline or
// closing brace that ends the declaration.
const styleValues = (source: string, property: string): string[] =>
  [...source.matchAll(new RegExp(`\\b${property}\\s*:\\s*([^\\n,};}]+)`, 'g'))].map(
    ([, value]) => (value ?? '').trim()
  );

const QUOTED_VALUE = /^(['"`])([\s\S]*)\1$/;

// An animation shorthand reads the same in both files: quoted inside a TS
// style object, bare inside a CSS rule. The reader strips the optional
// quotes so both land on the same value.
const animationDeclarations = (source: string): string[] =>
  styleValues(source, 'animation').map(
    (value) => (QUOTED_VALUE.exec(value)?.[2] ?? value).trim()
  );

// A CSS animation shorthand can carry the keyframes name in any slot, but
// every POS declaration leads with it, so the leading token is the name.
// `null` means the shorthand is in a shape this reader does not
// understand, which is reported rather than dropped.
const NAME_TOKEN = /^-?[_a-zA-Z][\w-]*$/;

const animationNameOf = (declaration: string): string | null => {
  const leading = declaration.split(/\s+/)[0] ?? '';
  return NAME_TOKEN.test(leading) ? leading : null;
};

const declaredKeyframes = (css: string): Set<string> =>
  new Set(
    [...css.matchAll(/@keyframes\s+([-\w]+)/g)]
      .map(([, name]) => name ?? '')
      .filter((name) => name.length > 0)
  );

// `.item-enter { animation: slideIn ... }` -> `item-enter` -> `slideIn`.
// The class name a component writes in `className` is the whole link
// between a component and a stylesheet-driven animation, so the link is
// parsed out of the stylesheet instead of assumed.
const animatedClasses = (css: string): Map<string, string> => {
  const links = new Map<string, string>();
  for (const [, selector, body] of css.matchAll(/\.([A-Za-z][\w-]*)\s*\{([^}]*)\}/g)) {
    const declaration = animationDeclarations(body ?? '')[0];
    const name = declaration === undefined ? null : animationNameOf(declaration);
    if (selector !== undefined && name !== null) links.set(selector, name);
  }
  return links;
};

const componentClassNames = (source: string): string[] =>
  [...source.matchAll(/className\s*=\s*"([^"]*)"/g)]
    .flatMap(([, value]) => (value ?? '').split(/\s+/))
    .filter((className) => className.length > 0);

const tokenReferences = (source: string, objectName: string): string[] => [
  ...new Set(
    [...source.matchAll(new RegExp(`\\b${objectName}\\.(\\w+)`, 'g'))]
      .map(([, token]) => token ?? '')
      .filter((token) => token.length > 0)
  )
];

// Keys of a `export const X = { ... } as const;` literal in `types.ts`.
const declaredKeys = (source: string, objectName: string): string[] => {
  const block =
    new RegExp(`export const ${objectName} = \\{([\\s\\S]*?)\\} as const;`).exec(source)?.[1] ?? '';
  return [
    ...block.matchAll(/^\s*([A-Za-z_]\w*)\s*:/gm),
  ]
    .map(([, key]) => key ?? '')
    .filter((key) => key.length > 0);
};

// The same literal, but read as `key -> value`. Only single-quoted string
// values are captured: every palette entry in `types.ts` is a colour
// literal, and a value this reader cannot see is a value it must not
// silently treat as matching.
const declaredEntries = (source: string, objectName: string): Map<string, string> => {
  const block =
    new RegExp(`export const ${objectName} = \\{([\\s\\S]*?)\\} as const;`).exec(source)?.[1] ?? '';
  const entries = new Map<string, string>();
  for (const [, key, value] of block.matchAll(/^\s*([A-Za-z_]\w*)\s*:\s*'([^']*)'/gm)) {
    if (key !== undefined && value !== undefined) entries.set(key, value);
  }
  return entries;
};

// Custom properties declared inside the `:root` block of the shell
// stylesheet, read as `--name -> value`.
const rootCustomProperties = (css: string): Map<string, string> => {
  const block = /^:root\s*\{([\s\S]*?)\}/m.exec(css)?.[1] ?? '';
  const entries = new Map<string, string>();
  for (const [, name, value] of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    if (name !== undefined && value !== undefined) entries.set(name, value.trim());
  }
  return entries;
};

describe('POS test harness', () => {
  it('resolves the frontend package root without relying on the launch directory', () => {
    // `process.cwd()` is deliberately not consulted here: it may or may
    // not be the package root depending on where vitest was started.
    expect(existsSync(fixturePath('vite.config.js'))).toBe(true);
    expect(existsSync(fixturePath('package.json'))).toBe(true);
    expect(readFixture('package.json')).toContain('"name": "frontend"');
    expect(frontendRoot.endsWith('frontend')).toBe(true);
  });

  it('reads every fixture it asserts on', () => {
    expect(readFixture('index.html')).toContain('<!doctype html>');
    expect(readFixture(POS_ENTRY)).toContain('./pos/render');
    expect(readFixture(POS_STYLESHEET)).toContain('@keyframes');
    expect(readFixture(POS_TYPES)).toContain('export const FS');
    for (const module of POS_MODULES) {
      expect(readFixture(module)).toContain('FS.');
    }
  });
});

describe('POS stylesheet wiring', () => {
  it('imports the POS stylesheet from the page entry', () => {
    // Without this import the @keyframes stay on disk and never reach the
    // browser, which is the original regression this whole slice exists for.
    expect(readFixture(POS_ENTRY)).toMatch(/import\s+(['"])\.\/pos\/pos\.css\1/);
  });

  it('reads animation names off the animation property only', () => {
    // The modules are full of `transition: 'all 0.2s'` declarations with
    // the same shape as an animation shorthand. A reader loose enough to
    // pick those up would report a keyframes named `all`.
    const transitions = POS_MODULES.flatMap((module) =>
      styleValues(readFixture(module), 'transition')
    );
    expect(transitions.length).toBeGreaterThan(0);

    expect(
      animationDeclarations("const s = { transition: 'all 0.2s', animationName: 'slideIn' };")
    ).toEqual([]);
  });

  it('declares a @keyframes for every animation a POS component names', () => {
    const declarations = POS_MODULES.flatMap((module) =>
      animationDeclarations(readFixture(module))
    );
    // Non-vacuity: no declarations means the reader stopped matching.
    expect(declarations.length).toBeGreaterThan(0);
    // Every shorthand must be in a shape the reader understands.
    expect(declarations.filter((declaration) => animationNameOf(declaration) === null)).toEqual(
      []
    );

    const declared = declaredKeyframes(readFixture(POS_STYLESHEET));
    expect(declared.size).toBeGreaterThan(0);

    const missing = [
      ...new Set(
        declarations
          .map(animationNameOf)
          .filter((name): name is string => name !== null)
          .filter((name) => !declared.has(name))
      ),
    ];
    expect(missing).toEqual([]);
  });

  it('declares a @keyframes for every animation the stylesheet applies', () => {
    // Covers the class-driven animations (`item-enter`, `flash-green`),
    // which no component names inline.
    const css = readFixture(POS_STYLESHEET);
    const declarations = animationDeclarations(css);
    expect(declarations.length).toBeGreaterThan(0);

    const declared = declaredKeyframes(css);
    const missing = [
      ...new Set(
        declarations
          .map(animationNameOf)
          .filter((name): name is string => name !== null)
          .filter((name) => !declared.has(name))
      ),
    ];
    expect(missing).toEqual([]);
  });

  it('resolves every animated class a POS component uses to a declared @keyframes', () => {
    const css = readFixture(POS_STYLESHEET);
    const links = animatedClasses(css);
    const declared = declaredKeyframes(css);

    const used = POS_MODULES.flatMap((module) => componentClassNames(readFixture(module)));
    const linked = used.filter((className) => links.has(className));
    // Non-vacuity: `render.tsx` puts `item-enter` on every cart row.
    expect(linked.length).toBeGreaterThan(0);
    expect(links.has('item-enter')).toBe(true);

    const broken = linked
      .map((className) => ({ className, name: links.get(className) ?? '' }))
      .filter(({ name }) => !declared.has(name))
      .map(({ className, name }) => `${className} -> ${name}`);
    expect(broken).toEqual([]);
  });
});

describe('POS typographic scale adoption', () => {
  it('declares no fontSize outside the FS scale', () => {
    const offenders = POS_MODULES.flatMap((module) =>
      styleValues(readFixture(module), 'fontSize')
        .filter((value) => !/^FS\.\w+$/.test(value))
        .map((value) => `${module}: fontSize: ${value}`)
    );

    const declared = POS_MODULES.map((module) =>
      styleValues(readFixture(module), 'fontSize').length
    );
    // Non-vacuity: the POS declares dozens of sizes, all of them scaled.
    expect(Math.max(...declared)).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it('declares no raw DM Mono family literal', () => {
    // Non-vacuity: the monospace role really is in use, so a literal
    // appearing alongside it would be a second source of truth.
    const sources = POS_MODULES.map(readFixture);
    expect(sources.some((source) => source.includes('FONT.mono'))).toBe(true);

    const offenders = POS_MODULES.filter((module) =>
      /['"]DM Mono['"]|['"]DM\+Mono['"]/.test(readFixture(module))
    );
    expect(offenders).toEqual([]);
  });

  it('resolves every fontFamily to one of the two FONT roles', () => {
    const offenders = POS_MODULES.flatMap((module) =>
      styleValues(readFixture(module), 'fontFamily')
        .filter((value) => value !== 'FONT.sans' && value !== 'FONT.mono')
        .map((value) => `${module}: fontFamily: ${value}`)
    );

    const declared = POS_MODULES.map((module) =>
      styleValues(readFixture(module), 'fontFamily').length
    );
    expect(Math.max(...declared)).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it('references only scale and font-role tokens that types.ts declares', () => {
    const types = readFixture(POS_TYPES);
    const source = POS_MODULES.map(readFixture).join('\n');

    const scaleTokens = tokenReferences(source, 'FS');
    const fontTokens = tokenReferences(source, 'FONT');
    // Non-vacuity on both axes.
    expect(scaleTokens.length).toBeGreaterThan(0);
    expect(fontTokens.length).toBeGreaterThan(0);

    const declaredScale = declaredKeys(types, 'FS');
    const declaredFonts = declaredKeys(types, 'FONT');
    expect(declaredScale.length).toBeGreaterThan(0);
    expect(declaredFonts.length).toBeGreaterThan(0);

    expect(scaleTokens.filter((token) => !declaredScale.includes(token))).toEqual([]);
    expect(fontTokens.filter((token) => !declaredFonts.includes(token))).toEqual([]);
  });
});

// ============================================================
// PALETTE OWNERSHIP
// ============================================================
//
// `src/index.css` declares the palette in `:root` and
// `pages/pos/types.ts` re-implements the same colours as `C`. Neither
// owner reads the other, so one could move while the other stayed and
// nothing would notice.
//
// `C` deliberately keeps literal values instead of `var(--token)`
// strings, because it is consumed in three places where an unresolved
// value is invisible to every check in this repo: SVG presentation
// attributes (`stroke={C.textLight}`), CSSOM writes from hover and
// focus handlers (`style.border = '1px solid ' + C.accent`) and inline
// style objects. The browser silently ignores an unresolvable value in
// all three, and neither jsdom nor the build can observe it. So the
// value stays duplicated and these tests are what make the duplication
// detectable instead of silent.
describe('POS palette ownership', () => {
  // `:root` custom property name for a palette token. Observed to be the
  // plain `--` + token transform for every key, camelCase included: the
  // stylesheet really does spell them `--textMid`, `--accentHov`,
  // `--accentBg`, `--dangerBg` and `--amberBg`.
  const rootPropertyFor = (token: string): string => `--${token}`;

  // The only `:root` properties the POS palette does not own, as bare
  // names because `rootCustomProperties` strips the leading dashes.
  // These are font stacks, not colours.
  const FONT_STACKS = ['font-sans', 'font-mono'];

  it('declares every C token in :root with the same value', () => {
    const palette = declaredEntries(readFixture(POS_TYPES), 'C');
    const root = rootCustomProperties(readFixture(INDEX_CSS));

    // Non-vacuity: the palette really is being read out of `types.ts`.
    expect(palette.size).toBeGreaterThan(0);

    const drift = [...palette].flatMap(([token, value]) => {
      const declared = root.get(token);
      if (declared === undefined) return [`${token}: :root declares no ${rootPropertyFor(token)}`];
      return declared === value ? [] : [`${token}: C=${value} but :root ${rootPropertyFor(token)}=${declared}`];
    });

    expect(drift).toEqual([]);
  });

  it('declares every :root colour property in C', () => {
    const palette = declaredEntries(readFixture(POS_TYPES), 'C');
    const root = rootCustomProperties(readFixture(INDEX_CSS));

    const orphans = [...root.keys()].filter((name) => !palette.has(name));

    // The palette owns every colour `:root` declares. Adding a colour to
    // `:root` without mirroring it in `C` is the drift this catches, so
    // the only permitted extras are the two font stacks, asserted by
    // name AND by shape: a colour could not pass for a stack.
    expect(orphans).toEqual(FONT_STACKS);
    for (const name of FONT_STACKS) {
      const declared = root.get(name) ?? '';
      expect(declared).toMatch(/^'[^']+'/);
      expect(declared).not.toMatch(/^#|^rgba/);
    }
  });

  it('keeps the palette literal in C and out of the POS modules', () => {
    const palette = declaredEntries(readFixture(POS_TYPES), 'C');

    // Non-vacuity on both axes: the palette is non-empty and really does
    // carry colour values, so an empty reader cannot read as a pass.
    expect(palette.size).toBeGreaterThan(0);
    expect([...palette.values()].some((value) => value.startsWith('#'))).toBe(true);

    // `var()` inside `C` would reach the three consumers named above
    // unresolved and be dropped by the browser with nothing turning red.
    expect([...palette.values()].filter((value) => value.includes('var('))).toEqual([]);

    // The same shortcut inside a module would reintroduce the two-owner
    // split this whole suite exists to prevent, just less visibly.
    const viaVar = POS_MODULES.flatMap((module) => {
      const source = readFixture(module);
      return [...palette.keys()]
        .map((token) => rootPropertyFor(token))
        .filter((property) => source.includes(`var(${property})`))
        .map((property) => `${module}: var(${property})`);
    });
    expect(viaVar).toEqual([]);
  });
});
