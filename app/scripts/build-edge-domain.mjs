// Copie du domaine pour l'Edge Function `mcp` (docs/spec-mcp.md §7.1) : le runtime edge ne voit que supabase/functions/
// et Deno exige les extensions d'import. On copie src/domain/mcp/ et les modules du domaine qu'il importe (fermeture
// des imports relatifs) dans supabase/functions/_shared/domain/, en ajoutant « .ts » et en épinglant les paquets npm.
// `--check` : n'écrit rien, échoue si la copie n'est plus à jour (test unitaire edgeDomain.test.ts).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', 'src', 'domain');
const OUT = join(here, '..', '..', 'supabase', 'functions', '_shared', 'domain');
const NPM = { uuid: 'npm:uuid@14.0.3' };
const HEADER = '// Généré par app/scripts/build-edge-domain.mjs depuis app/src/domain : ne pas modifier.\n';
const IMPORT_RE = /(from\s+|import\s+)'([^']+)'/g;

// Cette méthode permet de lister les fichiers d'entrée (src/domain/mcp/*.ts hors tests, et ids.ts pour les UUID).
function entries() {
  return readdirSync(join(SRC, 'mcp'))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => posix.join('mcp', f))
    .concat('ids.ts');
}

// Cette méthode permet de réécrire les imports d'un fichier pour Deno et de renvoyer ses dépendances relatives.
function transform(rel) {
  const deps = [];
  const code = readFileSync(join(SRC, rel), 'utf8').replace(IMPORT_RE, (all, kw, spec) => {
    if (spec.startsWith('.')) {
      const target = posix.normalize(posix.join(posix.dirname(rel), `${spec}.ts`));
      if (!existsSync(join(SRC, target))) throw new Error(`Import introuvable dans ${rel} : ${spec}`);
      deps.push(target);
      return `${kw}'${spec}.ts'`;
    }
    if (NPM[spec]) return `${kw}'${NPM[spec]}'`;
    throw new Error(`Import non pris en charge dans ${rel} : ${spec}`);
  });
  return { code: HEADER + code, deps };
}

// Cette méthode permet de calculer la copie attendue : chemin relatif → contenu.
function build() {
  const out = new Map();
  const queue = entries();
  while (queue.length) {
    const rel = queue.shift();
    if (out.has(rel)) continue;
    const { code, deps } = transform(rel);
    out.set(rel, code);
    queue.push(...deps);
  }
  return out;
}

// Cette méthode permet de lister les fichiers déjà copiés (chemins relatifs posix).
function existing(dir = OUT, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) existing(p, acc);
    else acc.push(relative(OUT, p).split('\\').join('/'));
  }
  return acc;
}

const expected = build();
if (process.argv.includes('--check')) {
  const stale = [...expected].filter(([rel, code]) => {
    const p = join(OUT, rel);
    return !existsSync(p) || readFileSync(p, 'utf8') !== code;
  });
  const extra = existing().filter((rel) => !expected.has(rel));
  if (stale.length || extra.length) {
    console.error(
      `Copie du domaine pour l'Edge Function périmée (${[...stale.map(([r]) => r), ...extra].join(', ')}). ` +
        'Lancer `npm run edge:domain` depuis app/.',
    );
    process.exit(1);
  }
  console.log(`Copie du domaine à jour (${expected.size} fichiers).`);
} else {
  rmSync(OUT, { recursive: true, force: true });
  for (const [rel, code] of expected) {
    mkdirSync(dirname(join(OUT, rel)), { recursive: true });
    writeFileSync(join(OUT, rel), code);
  }
  console.log(`${expected.size} fichiers copiés dans ${relative(process.cwd(), OUT)}.`);
}
