// ============================================================
// POS - WEBFONTS AND ANIMATIONS (structural regression)
// ============================================================
//
// `jsdom` does not load webfonts and does not evaluate animation
// names, so there is no runnable test for "the font renders".
// These assertions read the shipped files from disk and guard the
// exact regression: the font link and the `@keyframes` living only
// inside a never-called `initStyles()`.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Vitest runs with cwd set to the `frontend` package root, so every
// path below is resolved against it. `import.meta.url` is unusable
// here: under the jsdom environment it is an http URL, not a file one.
const frontendRoot = process.cwd();

const read = (relativePath: string): string =>
  readFileSync(resolve(frontendRoot, relativePath), 'utf8');

const INDEX_HTML = 'index.html';
const INDEX_CSS = 'src/index.css';
const POS_STYLESHEET = 'src/pages/pos/pos.css';
const DEAD_STYLES_MODULE = 'src/pages/pos/styles.ts';

describe('POS webfonts and animations', () => {
  describe('index.html', () => {
    it('links the Google Fonts stylesheet', () => {
      expect(read(INDEX_HTML)).toMatch(
        /<link[^>]*rel="stylesheet"[^>]*href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*"/
      );
    });

    it('declares both preconnect hints', () => {
      const html = read(INDEX_HTML);
      expect(html).toMatch(/<link[^>]*rel="preconnect"[^>]*href="https:\/\/fonts\.googleapis\.com"/);
      expect(html).toMatch(/<link[^>]*rel="preconnect"[^>]*href="https:\/\/fonts\.gstatic\.com"/);
    });

    it('requests the Sora and DM Mono families', () => {
      const html = read(INDEX_HTML);
      expect(html).toContain('family=Sora');
      expect(html).toContain('family=DM+Mono');
    });
  });

  describe('pages/pos/pos.css', () => {
    it('declares every animation used by the POS components', () => {
      const css = read(POS_STYLESHEET);
      expect(css).toContain('@keyframes slideIn');
      expect(css).toContain('@keyframes fadeIn');
      expect(css).toContain('@keyframes scanPulse');
      expect(css).toContain('@keyframes flashGreen');
    });

    it('declares the item-enter and flash-green classes', () => {
      const css = read(POS_STYLESHEET);
      expect(css).toMatch(/\.item-enter\s*\{/);
      expect(css).toMatch(/\.flash-green\s*\{/);
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
      expect(read(INDEX_CSS)).not.toMatch(/body\s*\{[^}]*font-family:\s*'/);
    });
  });

  describe('pages/pos/styles.ts', () => {
    it('no longer exists', () => {
      expect(existsSync(resolve(frontendRoot, DEAD_STYLES_MODULE))).toBe(false);
    });
  });
});