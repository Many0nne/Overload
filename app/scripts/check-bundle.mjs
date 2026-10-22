// Budget du JS initial (§15 spec technique) : < 180 Ko gzip pour le point d'entrée et ses modulepreload,
// lus dans dist/index.html après `vite build`. Les écrans secondaires et uPlot, chargés en lazy, n'en font pas partie.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 180;
const dist = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const files = [
  ...html.matchAll(/<script[^>]+type="module"[^>]+src="\/([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/([^"]+\.js)"/g),
].map((m) => m[1]);

let total = 0;
for (const file of new Set(files)) {
  const kb = gzipSync(readFileSync(join(dist, file))).length / 1024;
  total += kb;
  console.log(`${kb.toFixed(1).padStart(7)} Ko  ${file}`);
}
console.log(`${total.toFixed(1).padStart(7)} Ko  JS initial gzip (budget ${BUDGET_KB} Ko)`);
if (files.length === 0) {
  console.error('Aucun script trouvé dans dist/index.html : lancer `vite build` avant.');
  process.exit(1);
}
if (total > BUDGET_KB) {
  console.error(`Budget dépassé de ${(total - BUDGET_KB).toFixed(1)} Ko.`);
  process.exit(1);
}
