import { groupPlates } from '@/domain/plates';
import type { WeightUnit } from '@/domain/types';
import { formatNumber } from '@/domain/units';

// Couleurs de compétition (norme IWF en kg ; codes usuels des disques en lb).
const COLORS: Record<WeightUnit, [number, string][]> = {
  kg: [
    [25, '#e5484d'],
    [20, '#3b82f6'],
    [15, '#eab308'],
    [10, '#22c55e'],
    [5, '#e5e5ea'],
    [2.5, '#e5484d'],
    [2, '#3b82f6'],
    [1.5, '#eab308'],
    [1, '#22c55e'],
  ],
  lb: [
    [55, '#e5484d'],
    [45, '#3b82f6'],
    [35, '#eab308'],
    [25, '#22c55e'],
    [10, '#e5e5ea'],
  ],
};
const CHROME = '#a1a1aa';
// Disque « plein diamètre » de référence : 20 kg / 45 lb.
const FULL: Record<WeightUnit, number> = { kg: 20, lb: 45 };

// Cette méthode permet de choisir la couleur d'un disque selon son poids et l'unité (gris chromé pour les petits).
function plateColor(plate: number, unit: WeightUnit): string {
  return COLORS[unit].find(([w]) => w === plate)?.[1] ?? CHROME;
}

// Cette méthode permet de calculer la hauteur (0–1) et l'épaisseur relative d'un disque, plus petit quand il est léger.
function plateShape(plate: number, unit: WeightUnit): { h: number; t: number } {
  const r = Math.min(plate / FULL[unit], 1.25);
  return { h: 0.36 + 0.64 * Math.sqrt(Math.min(r, 1)), t: 3 + 8 * (r / 1.25) };
}

// Cette méthode permet de formater un poids de disque (« 1,25 », « 2,5 »).
export function formatPlate(plate: number): string {
  return formatNumber(plate, 2);
}

// Cette méthode permet de résumer les disques d'un côté en texte (« 2 × 20 + 2,5 »), ou « barre seule ».
export function plateText(perSide: number[]): string {
  if (perSide.length === 0) return 'barre seule';
  return groupPlates(perSide)
    .map((g) => (g.count > 1 ? `${g.count} × ${formatPlate(g.plate)}` : formatPlate(g.plate)))
    .join(' + ');
}

// Cette méthode permet de dessiner la barre chargée : un côté (bandeau en séance) ou la barre entière (feuille),
// les disques empilés du plus lourd, contre la butée, au plus léger.
export function PlateBar(props: { perSide: number[]; unit: WeightUnit; full?: boolean; height: number }) {
  const H = props.height;
  const mid = H / 2;
  const W = props.full ? 330 : 150;
  const shapes = props.perSide.map((p) => ({ p, ...plateShape(p, props.unit) }));
  const scale = H / 40; // épaisseurs dessinées pour une hauteur de 40
  const grip = props.full ? W * 0.17 : 0;
  const collar = props.full ? W / 2 + grip : 46;

  // Cette méthode permet de placer les disques d'un côté à partir de la butée, dans le sens donné (+1 droite, −1 gauche).
  const side = (dir: 1 | -1) => {
    let x = dir === 1 ? collar + 6 : W - collar - 6;
    return shapes.map(({ p, h, t }, i) => {
      const w = t * scale;
      const rx = dir === 1 ? x : x - w;
      x += dir * (w + 1);
      return (
        <rect
          key={`${dir}-${i}`}
          x={rx}
          y={mid - (h * (H - 4)) / 2}
          width={w}
          height={h * (H - 4)}
          rx={2}
          fill={plateColor(p, props.unit)}
          stroke="var(--bg)"
          strokeWidth={1}
        />
      );
    });
  };

  return (
    <svg
      className="plate-bar"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={`Par côté : ${plateText(props.perSide)}`}
    >
      {props.full ? (
        <>
          <rect x={W / 2 - grip} y={mid - 2} width={2 * grip} height={4} fill="var(--muted)" />
          <rect x={4} y={mid - 4} width={W / 2 - grip - 4} height={8} rx={2} fill="var(--text-2)" />
          <rect
            x={W / 2 + grip}
            y={mid - 4}
            width={W / 2 - grip - 4}
            height={8}
            rx={2}
            fill="var(--text-2)"
          />
          {side(-1)}
        </>
      ) : (
        <>
          <rect x={0} y={mid - 2} width={collar - 4} height={4} fill="var(--muted)" />
          <rect x={collar - 4} y={mid - 7} width={6} height={14} rx={1} fill="var(--text-2)" />
          <rect x={collar + 2} y={mid - 4} width={W - collar - 2} height={8} rx={2} fill="var(--text-2)" />
        </>
      )}
      {side(1)}
    </svg>
  );
}
