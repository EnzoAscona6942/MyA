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

import { existsSync, readdirSync } from 'node:fs';
import { fixturePath, frontendRoot, readFixture } from './posTestRoot';

const INDEX_CSS = 'src/index.css';
const POS_ENTRY = 'src/pages/POS.tsx';
const POS_MODULE_DIR = 'src/pages/pos';
const POS_STYLESHEET = 'src/pages/pos/pos.css';

// The single owner of the palette, the type scale, the control sizes and the
// font roles. The POS re-exports these from its own `types.ts`, but the
// declarations themselves — and therefore the contracts below — read the
// theme module, which is where every consumer actually gets its values from.
const THEME = 'src/theme.ts';

// The audited POS modules: the ones that consume style objects, and so are
// subject to every contract in this file.
//
// This list is NOT the source of truth for the module set. `posModulesOnDisk`
// enumerates the directory and the harness suite asserts the two agree, so
// adding a third POS module fails the suite until somebody decides
// deliberately whether it belongs under the contracts.
const AUDITED_POS_MODULES = [
  'src/pages/pos/render.tsx',
  'src/pages/pos/components.tsx'
] as const;

// Discovered POS modules that are deliberately NOT audited, each with the
// reason on record. An omission is invisible; a named exclusion is a
// decision somebody can review, and it fails the suite if the module is
// deleted (see `harness` -> 'accounts for every POS module on disk').
const EXCLUDED_POS_MODULES: ReadonlyMap<string, string> = new Map([
  [
    'src/pages/pos/types.ts',
    'Re-exports the scale, palette, control-size and font-role tokens the audited modules consume, and adds the POS-local nav items, API response shapes and formatters. It is a facade over the owner, not a consumer: scanning it for fontSize or fontFamily usage would only find the definitions.'
  ],
  [
    'src/pages/pos/icons.tsx',
    'Inline SVG icon components. They render through attributes (stroke, fill, width), not style objects, so no font, size or animation declaration can appear.'
  ],
  [
    'src/pages/pos/logic.ts',
    'State and hooks only. It holds no JSX and no style objects, so there is nothing for the style contracts to read.'
  ]
]);

// Backwards-compatible alias used throughout the file.
const POS_MODULES = AUDITED_POS_MODULES;

// ── Extractors ───────────────────────────────────────────────

// Every `.ts` / `.tsx` module under `src/pages/pos/`, as package-relative
// paths with forward slashes.
//
// Enumerating the directory is what makes the completeness check possible:
// iterating `AUDITED_POS_MODULES` instead proves only that the audited list
// is internally consistent, so a third POS module left every contract green
// while it went entirely unexamined. `readdirSync` with `recursive` keeps a
// module added in a subdirectory from hiding.
const posModulesOnDisk = (): string[] =>
  readdirSync(fixturePath(POS_MODULE_DIR), { recursive: true, encoding: 'utf8' })
    .filter((entry) => /\.tsx?$/.test(entry))
    .map((entry) => `${POS_MODULE_DIR}/${entry.replace(/\\/g, '/')}`)
    .sort();

// A `DM Mono` family name appearing as a quoted or template-literal string,
// anywhere in the source and whatever follows it.
//
// Requiring the closing quote to sit immediately after the name, as the
// previous scan did, missed the two shapes that matter most: a family inside
// a template literal, and a family name embedded in a stack such as
// `` `DM Mono, monospace` ``. Both are quoted on the left and neither closes
// right after the name.
//
// It matches the *string*, not the role of the string. The family-role
// assertion reads only the `fontFamily` property, so a literal in any other
// position (a `style` object, a CSS template, a `const`) is exactly what
// this scan is for. The guard's own comment naming the intent lives in THIS
// file, never in a POS module, so it cannot match.
const RAW_MONO_FAMILY = /['"`][^'"`]*DM\s*\+?\s*Mono/;

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

// Class names written in a JSX `className` attribute.
//
// Three attribute forms are read, not just the double-quoted literal:
//   className="a b"        static literal
//   className='a b'        single-quoted literal
//   className={`a b`}      template literal with no interpolation
// An expression form carrying an interpolation (`className={`a ${x}`}`) is
// deliberately NOT flattened into class names: the literal segments around
// `${}` are not class names, and guessing at them would make the reader
// report classes the component never applies. Those attributes are still
// COUNTED, and `harness` asserts the count of collected attributes matches
// the count of `className=` occurrences, so an unreadable form fails the
// suite instead of quietly shrinking the scan.
//
// Each form is stripped of its delimiters before splitting, so
// `className="item-enter"` contributes the one class `item-enter`.
const CLASS_NAME_LITERAL =
  /className\s*=\s*(?:"([^"\\]*)"|'([^'\\]*)'|\{\s*`([^`\\$]*)`\s*\})/g;

// Total `className=` attributes, including the forms above cannot read.
const CLASS_NAME_OCCURRENCES = /\bclassName\s*=/g;

const componentClassNames = (source: string): string[] =>
  [...source.matchAll(CLASS_NAME_LITERAL)]
    .flatMap(([, doubleQuoted, singleQuoted, templateLiteral]) =>
      (doubleQuoted ?? singleQuoted ?? templateLiteral ?? '')
        .split(/\s+/)
        .filter((className) => className.length > 0)
    );

const tokenReferences = (source: string, objectName: string): string[] => [
  ...new Set(
    [...source.matchAll(new RegExp(`\\b${objectName}\\.(\\w+)`, 'g'))]
      .map(([, token]) => token ?? '')
      .filter((token) => token.length > 0)
  )
];

// Keys of a `export const X = { ... } as const;` literal in `theme.ts`.
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
// values are captured: every palette entry in `theme.ts` is a colour
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

  it('accounts for every POS module on disk', () => {
    // The completeness check the hardcoded list could never make. A third
    // POS module previously left every contract green while it went
    // entirely unexamined; now it fails until somebody decides whether it
    // belongs under the contracts.
    const discovered = posModulesOnDisk();

    // Non-vacuity on both sides: the directory really was enumerated, and
    // the audited list is not empty, so an empty reader cannot read as a
    // complete audit.
    expect(discovered.length).toBeGreaterThan(0);
    expect(AUDITED_POS_MODULES.length).toBeGreaterThan(0);

    const accounted = [...AUDITED_POS_MODULES, ...EXCLUDED_POS_MODULES.keys()].sort();

    // Every discovered module is audited or excluded by name, and nothing is
    // accounted for that no longer exists.
    expect(discovered).toEqual(accounted);

    // An audited module that was deleted or renamed fails here rather than
    // leaving a silently vacuous guard behind.
    expect(AUDITED_POS_MODULES.every((module) => discovered.includes(module))).toBe(true);

    // Every audited module must actually be readable.
    for (const module of AUDITED_POS_MODULES) {
      expect(readFixture(module).length).toBeGreaterThan(0);
    }
  });

  it('names a reason for every POS module it excludes from the contracts', () => {
    // An exclusion with no reason recorded is an omission wearing a
    // disguise, which is the exact failure mode the enumeration above
    // exists to prevent.
    for (const [module, reason] of EXCLUDED_POS_MODULES) {
      expect(module.length).toBeGreaterThan(0);
      expect(reason.trim().length).toBeGreaterThan(20);
    }
  });

  it('reads every fixture it asserts on', () => {
    expect(readFixture('index.html')).toContain('<!doctype html>');
    expect(readFixture(POS_ENTRY)).toContain('./pos/render');
    expect(readFixture(POS_STYLESHEET)).toContain('@keyframes');
    expect(readFixture(THEME)).toContain('export const FS');
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

  it('reads every className attribute the POS modules declare', () => {
    // The class-name contract used to be proven for the double-quoted form
    // only: a single-quoted or template-literal class name dropped out of
    // the scan while the non-vacuity anchors still passed, because the other
    // attributes kept the collected list non-empty. So the reader handles
    // all three literal forms, AND this test proves it read every attribute
    // there is — the count of collected attributes must equal the count of
    // `className=` occurrences. A form the reader cannot parse fails here
    // rather than silently narrowing the scan.
    const mismatches = POS_MODULES.flatMap((module) => {
      const source = readFixture(module);
      const occurrences = [...source.matchAll(CLASS_NAME_OCCURRENCES)].length;
      const collected = [...source.matchAll(CLASS_NAME_LITERAL)].length;
      return occurrences === collected ? [] : [`${module}: ${occurrences} className=, ${collected} read`];
    });
    expect(mismatches).toEqual([]);

    // Non-vacuity: `render.tsx` really does put classes on elements, and the
    // reader really does extract names out of them.
    const names = POS_MODULES.flatMap((module) => componentClassNames(readFixture(module)));
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain('item-enter');
  });

  it('reads class names from every literal attribute form', () => {
    // The reader's own contract, on synthetic JSX: all three forms the POS
    // could adopt must yield the same class names.
    const source = [
      'const a = <div className="alpha beta" />;',
      "const b = <div className='gamma delta' />;",
      'const c = <div className={`epsilon zeta`} />;'
    ].join('\n');

    expect(componentClassNames(source)).toEqual([
      'alpha',
      'beta',
      'gamma',
      'delta',
      'epsilon',
      'zeta'
    ]);

    // An interpolated expression is counted but not flattened, so the count
    // assertion above fails on it rather than inventing class names.
    const interpolated = 'const d = <div className={`eta ${x}`} />;';
    expect([...interpolated.matchAll(CLASS_NAME_LITERAL)].length).toBe(0);
    expect([...interpolated.matchAll(CLASS_NAME_OCCURRENCES)].length).toBe(1);
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

    // Non-vacuity is a PER-MODULE FLOOR, not a maximum. `Math.max` across
    // modules let a module that lost every `fontSize` declaration pass on
    // the strength of the other one, with an empty offender list reading as
    // a clean sweep. Every audited module must declare at least one, so
    // one module emptying out fails.
    const silent = POS_MODULES.filter(
      (module) => styleValues(readFixture(module), 'fontSize').length === 0
    );
    expect(silent).toEqual([]);

    expect(offenders).toEqual([]);
  });

  it('declares no raw DM Mono family literal', () => {
    // Non-vacuity on two axes: the monospace role really is in use, so a
    // literal appearing alongside it would be a second source of truth, and
    // the scan really does match the shapes it claims to (the self-test
    // below, so a broken pattern cannot read as a clean module).
    const sources = POS_MODULES.map(readFixture);
    expect(sources.some((source) => source.includes('FONT.mono'))).toBe(true);

    const offenders = POS_MODULES.filter((module) => RAW_MONO_FAMILY.test(readFixture(module)));
    expect(offenders).toEqual([]);
  });

  it('catches a DM Mono literal in every quoting form the modules could use', () => {
    // The scan's own contract. Previously the closing quote had to sit
    // immediately after the name, so a family inside a template literal or
    // embedded in a stack followed by a fallback list slipped past, and the
    // family-role assertion could not see it either: it reads only the
    // `fontFamily` property.
    const caught = [
      "fontFamily: 'DM Mono'",
      'fontFamily: "DM Mono"',
      'fontFamily: `DM Mono`',
      "fontFamily: 'DM Mono, monospace'",
      'const stack = `DM Mono, monospace`',
      "const s = { fontFamily: 'DM Mono, monospace', color: C.text }",
      "const url = 'https://fonts.googleapis.com/css?family=DM+Mono'",
      "const q = 'DM+Mono:wght@400'"
    ];
    for (const snippet of caught) {
      expect([snippet].some((source) => RAW_MONO_FAMILY.test(source))).toBe(true);
    }

    // And it must not fire on the legitimate role references, or the guard
    // would be unusable.
    const allowed = [
      "fontFamily: 'var(--font-mono, ui-monospace, Cascadia Mono, monospace)'",
      "fontFamily: 'var(--font-sans, system-ui, sans-serif)'",
      "const fontFamily = FONT.mono"
    ];
    for (const snippet of allowed) {
      expect([snippet].some((source) => RAW_MONO_FAMILY.test(source))).toBe(false);
    }
  });

  it('resolves every fontFamily to one of the two FONT roles', () => {
    const offenders = POS_MODULES.flatMap((module) =>
      styleValues(readFixture(module), 'fontFamily')
        .filter((value) => value !== 'FONT.sans' && value !== 'FONT.mono')
        .map((value) => `${module}: fontFamily: ${value}`)
    );

    // Per-module floor, for the same reason as the fontSize check above.
    const silent = POS_MODULES.filter(
      (module) => styleValues(readFixture(module), 'fontFamily').length === 0
    );
    expect(silent).toEqual([]);

    expect(offenders).toEqual([]);
  });

  it('references only scale and font-role tokens that the theme module declares', () => {
    const theme = readFixture(THEME);
    const source = POS_MODULES.map(readFixture).join('\n');

    const scaleTokens = tokenReferences(source, 'FS');
    const fontTokens = tokenReferences(source, 'FONT');
    // Non-vacuity on both axes.
    expect(scaleTokens.length).toBeGreaterThan(0);
    expect(fontTokens.length).toBeGreaterThan(0);

    const declaredScale = declaredKeys(theme, 'FS');
    const declaredFonts = declaredKeys(theme, 'FONT');
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
// `src/index.css` declares the palette in `:root` and `src/theme.ts`
// implements the same colours as `C`. Neither owner reads the other, so one
// could move while the other stayed and nothing would notice.
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
    const palette = declaredEntries(readFixture(THEME), 'C');
    const root = rootCustomProperties(readFixture(INDEX_CSS));

    // Non-vacuity: the palette really is being read out of the theme module.
    expect(palette.size).toBeGreaterThan(0);

    const drift = [...palette].flatMap(([token, value]) => {
      const declared = root.get(token);
      if (declared === undefined) return [`${token}: :root declares no ${rootPropertyFor(token)}`];
      return declared === value ? [] : [`${token}: C=${value} but :root ${rootPropertyFor(token)}=${declared}`];
    });

    expect(drift).toEqual([]);
  });

  it('declares every :root colour property in C', () => {
    const palette = declaredEntries(readFixture(THEME), 'C');
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
    const palette = declaredEntries(readFixture(THEME), 'C');

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
