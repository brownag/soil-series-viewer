import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = join(__dirname, '..', 'src', 'styles', 'usdastyle.css');
const css = readFileSync(cssPath, 'utf8');

test('usdastyle.css exists, is non-empty, and has balanced braces', () => {
  assert.ok(css.length > 0, 'stylesheet should not be empty');
  const openBraces = (css.match(/\{/g) || []).length;
  const closeBraces = (css.match(/\}/g) || []).length;
  assert.equal(openBraces, closeBraces, 'CSS braces must be balanced');
  assert.ok(openBraces >= 15, 'expected multiple CSS rules');
});

test('defines required USDA/NRCS palette custom properties and colors', () => {
  assert.match(css, /:root\s*\{/);
  const requiredTokens = [
    '#3e3e3e',
    '#ffffff',
    '#000000',
    '#248621',
    '#228623',
    '#000099',
    '#660099',
    '#B8B8B8',
  ];
  for (const hex of requiredTokens) {
    assert.ok(
      css.toLowerCase().includes(hex.toLowerCase()),
      `expected stylesheet to contain palette token ${hex}`
    );
  }
});

test('defines page chrome, centered 767px body container, and font stacks', () => {
  assert.match(css, /max-width:\s*(?:var\(--usda-container-width\)|767px)/);
  assert.match(css, /--usda-container-width:\s*767px/);
  assert.match(css, /margin:\s*0 auto/);
  assert.match(css, /Verdana,\s*Geneva,\s*sans-serif/);
  assert.match(css, /11px/);
  assert.match(css, /Georgia,\s*"Times New Roman",\s*Times,\s*serif/);
});

test('defines table header, link state, and footer border rules', () => {
  assert.match(css, /th\.THBorder[\s\S]*?background-color:\s*(?:var\(--usda-table-header-bg\)|#248621)/);
  assert.match(css, /border-bottom:\s*1px solid (?:var\(--usda-table-border\)|#228623)/);
  assert.match(css, /a:link\s*\{[\s\S]*?color:\s*(?:var\(--usda-link\)|#000099)/);
  assert.match(css, /a:visited\s*\{[\s\S]*?color:\s*(?:var\(--usda-link-visited\)|#660099)/);
  assert.match(css, /a:hover\s*\{[\s\S]*?text-decoration:\s*underline/);
  assert.match(css, /\.footertable[\s\S]*?border-top:\s*1px solid (?:var\(--usda-footer-border\)|#B8B8B8)/);
});

test('defines series layout classes, responsive 767px collapse, and print rules', () => {
  const requiredClasses = [
    '.osd-page',
    '.osd-chrome',
    '.osd-header',
    '.osd-meta',
    '.osd-downloads',
    '.osd-narrative',
    '.osd-section',
    '.osd-pedon-layout',
    '.osd-pedon-text',
    '.osd-pedon-sketch',
    '.osd-table',
    '.osd-footer',
    '.osd-series-link',
    '.osd-competing-panel',
    '.osd-competing-heading',
    '.osd-competing-family',
    '.osd-competing-grid',
    '.osd-competing-card',
    '.osd-competing-strip',
    '.osd-competing-name',
    '.osd-competing-more',
    '.osd-qa-notes',
    '.osd-qa-item',
    '.osd-qa-warn',
    '.osd-qa-info',
  ];
  for (const cls of requiredClasses) {
    assert.ok(css.includes(cls), `expected layout class ${cls}`);
  }

  assert.match(
    css,
    /@media\s*\(\s*max-width:\s*767px\s*\)\s*\{[\s\S]*?\.osd-pedon-layout\s*\{[\s\S]*?flex-direction:\s*column/
  );
  assert.match(
    css,
    /@media\s+print\s*\{[\s\S]*?background-color:\s*#ffffff[\s\S]*?\.osd-chrome[\s\S]*?\.osd-qa-notes[\s\S]*?display:\s*none/
  );
});
