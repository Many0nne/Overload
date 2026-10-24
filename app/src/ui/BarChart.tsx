import { useState } from 'react';

const W = 354;
const H = 140;
const P = { l: 4, r: 4, t: 8, b: 22 };

// Cette méthode permet de dessiner un histogramme hebdomadaire en SVG (dernière barre pleine), avec info-bulle au toucher.
export function BarChart(props: {
  values: number[];
  labels: string[]; // libellé de chaque barre (info-bulle)
  format: (v: number) => string;
  firstLabel: string;
  lastLabel: string;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = props.values.length;
  const max = Math.max(...props.values, 0) * 1.1 || 1;
  const slot = (W - P.l - P.r) / Math.max(1, n);
  const bw = Math.max(2, slot - 6);
  const inner = H - P.t - P.b;
  const hv = hover !== null ? props.values[hover] : undefined;

  return (
    <div className="chart-wrap mt-8">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={props.ariaLabel}
        onPointerLeave={() => setHover(null)}
      >
        <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} stroke="var(--line)" />
        {props.values.map((v, i) => {
          const h = (inner * v) / max;
          const x = P.l + i * slot + 3;
          const y = H - P.b - h;
          const r = Math.min(4, h / 2, bw / 2);
          return (
            <g key={props.labels[i] ?? i}>
              {h > 0 && (
                <path
                  d={`M${x} ${H - P.b}V${y + r}q0 ${-r} ${r} ${-r}h${bw - 2 * r}q${r} 0 ${r} ${r}V${H - P.b}z`}
                  fill="var(--accent)"
                  opacity={i === n - 1 || i === hover ? 1 : 0.55}
                />
              )}
              <rect
                x={P.l + i * slot}
                y={0}
                width={slot}
                height={H}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
                onPointerDown={() => setHover(i)}
              />
            </g>
          );
        })}
        <text x={P.l} y={H - 6} fontSize="10" fill="var(--muted)">
          {props.firstLabel}
        </text>
        <text x={W - P.r} y={H - 6} fontSize="10" fill="var(--muted)" textAnchor="end">
          {props.lastLabel}
        </text>
      </svg>
      {hover !== null && hv !== undefined && (
        <div
          className="tip show"
          style={{
            left: `${((P.l + (hover + 0.5) * slot) / W) * 100}%`,
            top: `${((H - P.b - (inner * hv) / max) / H) * 100}%`,
          }}
        >
          {props.format(hv)}
          <span>{props.labels[hover]}</span>
        </div>
      )}
    </div>
  );
}
