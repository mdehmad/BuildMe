// Inlines src/*.js into src/template.html.
//   dist/index.html    – standalone app (Cloudflare Workers static assets, any static host, or open locally)
//   artifact/artifact.html – body-only variant for publishing as a claude.ai Artifact
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(join(root, f), 'utf8');
const parts = { ENGINE: 'src/engine.js', RENDER: 'src/render.js', M3D: 'src/model3d.js', EXPORT: 'src/export.js', APP: 'src/app.js' };

let body = read('src/template.html');
for (const [key, file] of Object.entries(parts)) {
  const marker = `/*${key}*/`;
  if (!body.includes(marker)) throw new Error(`Template is missing ${marker}`);
  body = body.replace(marker, () => read(file));
}

const head = '<!doctype html><html lang="en"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  + '<meta name="description" content="BuildMe — home design assistant for Islamabad plots: CDA bylaw-checked plans, 3D models, elevation styles and cost estimates.">'
  + '<link rel="icon" href="favicon.svg" type="image/svg+xml"><meta name="theme-color" content="#1E6FD9">'
  + '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
  + '</head><body>';

mkdirSync(join(root, 'dist'), { recursive: true });
mkdirSync(join(root, 'artifact'), { recursive: true });
writeFileSync(join(root, 'artifact/artifact.html'), body);
writeFileSync(join(root, 'dist/index.html'), head + body + '</body></html>');
writeFileSync(join(root, 'dist/favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="11" fill="#1E6FD9"/><path d="M9 20.5 20 11l11 9.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 19v10h14V19" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><rect x="17.5" y="22.5" width="5" height="6.5" rx="1" fill="#8CC2FF"/></svg>');
console.log(`Built dist/index.html (${(body.length / 1024).toFixed(0)} KB) and artifact/artifact.html`);
