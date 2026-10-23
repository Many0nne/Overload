// Génère app/src/data/bodyMap.generated.ts : silhouettes face/dos de la carte musculaire.
// Les tracés viennent de MuscleMap (Melih Colpan, licence MIT), fournis en source Swift, convertis tels quels.
// Usage : npx tsx scripts/build-body-map.ts
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Version figée de MuscleMap (dernier commit connu au moment de la rédaction).
const SOURCE_SHA = '5f576a5d3d697c3720abfada8e618d1cef08ea32';
const BASE = `https://raw.githubusercontent.com/melihcolpan/MuscleMap/${SOURCE_SHA}`;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Sous-groupes superposés à leur muscle parent : retirés (seuls les groupes entiers sont colorés).
// Chevilles, adducteurs et cou restent : ce sont des zones à part entière du dessin.
const DROPPED = new Set([
  'hair', 'upperChest', 'lowerChest', 'innerQuad', 'outerQuad', 'hipFlexors',
  'upperAbs', 'lowerAbs', 'frontDeltoid', 'rearDeltoid', 'upperTrapezius', 'lowerTrapezius',
]);

const VIEW_BOXES = { front: '0 95 727 1280', back: '718 95 727 1280' } as const;

// Cette méthode permet d'extraire de la source Swift chaque zone (slug) et la liste de ses tracés SVG.
function parseSwift(src: string): { slug: string; d: string[] }[] {
  return src
    .split('BodyPartPathData(')
    .slice(1)
    .map((block) => {
      const slug = /slug:\s*\.(\w+)/.exec(block)?.[1];
      if (!slug) throw new Error('Zone sans slug dans la source MuscleMap');
      return { slug, d: [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]!) };
    })
    .filter((p) => !DROPPED.has(p.slug) && p.d.length > 0);
}

// Cette méthode permet de télécharger un fichier de tracés MuscleMap et de le convertir.
async function load(file: string) {
  const res = await fetch(`${BASE}/Sources/MuscleMap/Data/${file}`);
  if (!res.ok) throw new Error(`${file} : HTTP ${res.status}`);
  return parseSwift(await res.text());
}

const license = await fetch(`${BASE}/LICENSE`).then((r) => r.text());
const front = await load('MaleFrontPaths.swift');
const back = await load('MaleBackPaths.swift');

const header = `/*! @license Tracés de la carte musculaire dérivés de MuscleMap
 * (https://github.com/melihcolpan/MuscleMap, commit ${SOURCE_SHA}).
 * Fichier généré par scripts/build-body-map.ts : ne pas modifier à la main.
 *
${license.trim().split('\n').map((l) => ` * ${l}`.trimEnd()).join('\n')}
 */
`;
const body = `export type BodyPart = { slug: string; d: string[] };
export type BodyView = { viewBox: string; parts: BodyPart[] };

export const BODY_FRONT: BodyView = ${JSON.stringify({ viewBox: VIEW_BOXES.front, parts: front })};

export const BODY_BACK: BodyView = ${JSON.stringify({ viewBox: VIEW_BOXES.back, parts: back })};
`;
writeFileSync(resolve(root, 'app/src/data/bodyMap.generated.ts'), header + '\n' + body);
console.log(`Face : ${front.length} zones, dos : ${back.length} zones`);
