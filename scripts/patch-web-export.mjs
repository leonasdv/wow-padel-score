import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const pwaDir = join(process.cwd(), 'web-pwa');

for (const file of ['manifest.json', 'icon-192.png', 'icon-512.png', 'icon-180.png']) {
  copyFileSync(join(pwaDir, file), join(distDir, file));
}

const htmlPath = join(distDir, 'index.html');
const html = readFileSync(htmlPath, 'utf8');

if (html.includes('rel="manifest"')) {
  console.log('dist/index.html already has PWA tags — skipped.');
  process.exit(0);
}

const pwaTags = [
  '<link rel="manifest" href="manifest.json" />',
  '<meta name="theme-color" content="#0B1E3B" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  '<meta name="apple-mobile-web-app-title" content="WOW Padel" />',
  '<link rel="apple-touch-icon" href="icon-180.png" />',
].join('\n    ');

writeFileSync(htmlPath, html.replace('</head>', `    ${pwaTags}\n  </head>`));
console.log('Patched dist/index.html with PWA tags.');
