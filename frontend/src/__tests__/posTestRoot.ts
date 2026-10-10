// ============================================================
// TEST HARNESS - LAUNCH-DIRECTORY INDEPENDENT PACKAGE ROOT
// ============================================================
//
// The structural suites read fixtures off disk. Those fixtures used to
// resolve from `process.cwd()`, which made every assertion depend on an
// undocumented launcher invariant: run vitest from anywhere other than
// the `frontend` package root and the assertions failed with a bare
// ENOENT instead of failing on behaviour.
//
// The anchor is picked from a list rather than trusted outright. A
// jsdom environment was previously observed handing back an http URL
// for `import.meta.url`, so it is only used after checking it is still
// a `file:` one; that guard is cheap and keeps the failure loud if the
// behaviour ever returns. The search then runs in both directions,
// because a launcher sitting at the monorepo root points *down* at the
// package while a launcher inside the package points *up*. When nothing
// matches, the harness throws the list of directories it probed rather
// than letting each fixture read fail with ENOENT.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// A frontend package root carries both the vite config and the package
// manifest; either file alone could match something unrelated.
const ROOT_MARKERS = ['vite.config.js', 'package.json'] as const;

// Marker filenames alone do not identify a package. A monorepo root or a
// sibling package that ships a vite config would satisfy `ROOT_MARKERS` and
// be accepted, and both suites would then fail together on fixtures that are
// missing from it — a message pointing at the harness rather than at the
// wrongly chosen directory. The manifest name is the identity assertion, and
// it lives here rather than in one suite so a caller cannot skip it.
const EXPECTED_PACKAGE_NAME = 'frontend';

// Never a package root, and expensive to walk.
const SKIPPED_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage', '.opencode']);

// How far below an anchor to look. The monorepo root holds the package as
// a direct child; two levels is slack for a nested checkout without
// letting the walk escape into a large tree.
const MAX_DOWN = 2;

// `"name"` off the manifest at `dir`, or `null` when it is absent, unreadable
// or not a JSON object. A manifest this reader cannot see never identifies
// the package.
const manifestName = (dir: string): string | null => {
  const isNamed = (value: unknown): value is { name: unknown } =>
    typeof value === 'object' && value !== null && 'name' in value;

  try {
    const parsed: unknown = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    if (!isNamed(parsed)) return null;
    return typeof parsed.name === 'string' ? parsed.name : null;
  } catch {
    return null;
  }
};

const isFrontendRoot = (dir: string): boolean =>
  ROOT_MARKERS.every((marker) => existsSync(join(dir, marker))) &&
  manifestName(dir) === EXPECTED_PACKAGE_NAME;

const subdirectories = (dir: string): string[] => {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !SKIPPED_DIRS.has(entry.name))
      .map((entry) => join(dir, entry.name));
  } catch {
    return [];
  }
};

const ancestorsOf = (start: string): string[] => {
  const chain: string[] = [];
  let current = resolve(start);
  for (;;) {
    chain.push(current);
    const parent = dirname(current);
    if (parent === current) return chain;
    current = parent;
  }
};

// Where to search from, most trustworthy first: this module's own
// directory is independent of the launcher, so it wins whenever the
// module metadata survives the transform.
const anchors = (): string[] => {
  const found: string[] = [];

  const ownDirectory = import.meta.dirname;
  if (typeof ownDirectory === 'string' && ownDirectory.length > 0) {
    found.push(resolve(ownDirectory));
  }

  const ownUrl = import.meta.url;
  if (typeof ownUrl === 'string' && ownUrl.startsWith('file:')) {
    const fromUrl = fileURLToPath(ownUrl);
    found.push(dirname(fromUrl));
  }

  found.push(resolve(process.cwd()));

  return [...new Set(found)];
};

const findFrontendRoot = (): { root: string | null; probed: string[] } => {
  const probed: string[] = [];
  const searchAnchors = anchors();

  for (const anchor of searchAnchors) {
    for (const dir of ancestorsOf(anchor)) {
      probed.push(dir);
      if (isFrontendRoot(dir)) return { root: dir, probed };
    }
  }

  for (const anchor of searchAnchors) {
    let frontier = subdirectories(resolve(anchor));
    for (let level = 0; level < MAX_DOWN && frontier.length > 0; level += 1) {
      const next: string[] = [];
      for (const dir of frontier) {
        probed.push(dir);
        if (isFrontendRoot(dir)) return { root: dir, probed };
        next.push(...subdirectories(dir));
      }
      frontier = next;
    }
  }

  return { root: null, probed };
};

const located = findFrontendRoot();

if (located.root === null) {
  throw new Error(
    'Test harness could not locate the `frontend` package root.\n' +
      `Expected a directory containing ${ROOT_MARKERS.join(' and ')} whose package.json ` +
      `declares "name": "${EXPECTED_PACKAGE_NAME}", searched upwards ` +
      `to the filesystem root and then ${MAX_DOWN} levels downwards from: ` +
      `${anchors().join(', ')}.\n` +
      `Directories probed: ${located.probed.join(', ')}.\n` +
      'Run vitest from inside the frontend package, or from a directory that contains it.'
  );
}

/** Absolute path of the `frontend` package root, whatever the launcher cwd is. */
export const frontendRoot: string = located.root;

/** Absolute path of a fixture inside the package. */
export const fixturePath = (...segments: string[]): string =>
  resolve(frontendRoot, ...segments);

/** Reads a fixture as UTF-8 text. */
export const readFixture = (relativePath: string): string =>
  readFileSync(fixturePath(relativePath), 'utf8');
