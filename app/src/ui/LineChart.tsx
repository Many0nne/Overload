// Courbe d'évolution (uPlot, chargée uniquement par les écrans secondaires en lazy, spec technique §14).
import { useEffect, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useSettings } from '@/data/queries';

export type ChartPoint = { t: number; v: number };

const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const longDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

// Cette méthode permet de lire une variable CSS du thème courant (uPlot dessine sur un canevas, sans CSS).
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

// Cette méthode permet d'aligner la série principale, la tendance et l'objectif sur un même axe de temps (secondes).
function alignData(points: ChartPoint[], trend: ChartPoint[], goal: number | undefined): uPlot.AlignedData {
  const xs = [...new Set([...points.map((p) => p.t), ...trend.map((p) => p.t)])].sort((a, b) => a - b);
  const main = new Map(points.map((p) => [p.t, p.v]));
  const tr = new Map(trend.map((p) => [p.t, p.v]));
  const first = xs[0];
  const last = xs[xs.length - 1];
  const data: (number | null)[][] = [
    xs.map((t) => main.get(t) ?? null),
    xs.map((t) => tr.get(t) ?? null),
    xs.map((t) => (goal !== undefined && (t === first || t === last) ? goal : null)),
  ];
  return [xs.map((t) => t / 1000), ...data] as uPlot.AlignedData;
}

// Cette méthode permet d'afficher une courbe à une série, avec tendance pointillée et objectif doré facultatifs,
// réticule et info-bulle au survol ou au toucher.
export function LineChart(props: {
  points: ChartPoint[];
  trend?: ChartPoint[];
  goal?: number;
  format: (v: number) => string; // valeur canonique → texte affiché
  axis?: (v: number) => string; // graduation de l'axe vertical
  height?: number;
  ariaLabel: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const { theme } = useSettings();
  const [tip, setTip] = useState<{ left: number; top: number; v: number; t: number } | null>(null);
  const fmt = useRef(props.format);
  fmt.current = props.format;
  const axisRef = useRef(props.axis ?? props.format);
  axisRef.current = props.axis ?? props.format;

  // biome-ignore lint/correctness/useExhaustiveDependencies: le thème change les couleurs lues dans le CSS
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const accent = cssVar('--accent');
    const muted = cssVar('--muted');
    const line = cssVar('--line');
    const gold = cssVar('--gold');
    const axis: uPlot.Axis = {
      stroke: muted,
      grid: { stroke: line, width: 1 },
      ticks: { show: false },
      font: '10px system-ui',
    };
    const opts: uPlot.Options = {
      width: el.clientWidth || 320,
      height: props.height ?? 170,
      legend: { show: false },
      padding: [12, 8, 0, 0],
      cursor: { y: false, points: { size: 9, fill: accent }, drag: { x: false, y: false } },
      scales: { x: { time: true } },
      series: [
        {},
        {
          stroke: accent,
          width: 2,
          spanGaps: true,
          fill: `${accent}22`,
          points: { show: (u) => u.data[0].length < 40 },
        },
        { stroke: accent, width: 2, dash: [4, 4], spanGaps: true, points: { show: false } },
        { stroke: gold, width: 1.5, dash: [5, 4], spanGaps: true, points: { show: false } },
      ],
      axes: [
        {
          ...axis,
          grid: { show: false },
          values: (_u, splits) => splits.map((s) => shortDate.format(s * 1000)),
        },
        { ...axis, size: 44, values: (_u, splits) => splits.map((s) => axisRef.current(s)) },
      ],
      hooks: {
        setCursor: [
          (u) => {
            const i = u.cursor.idx;
            const v = i == null ? null : (u.data[1]?.[i] ?? null);
            if (i == null || v == null) return setTip(null);
            const t = u.data[0][i]!;
            setTip({ left: u.valToPos(t, 'x'), top: u.valToPos(v, 'y'), v, t: t * 1000 });
          },
        ],
      },
    };
    const u = new uPlot(opts, alignData(props.points, props.trend ?? [], props.goal), el);
    plot.current = u;
    const ro = new ResizeObserver(() => u.setSize({ width: el.clientWidth, height: props.height ?? 170 }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      u.destroy();
      plot.current = null;
      setTip(null);
    };
  }, [props.points, props.trend, props.goal, props.height, theme]);

  return (
    <div className="chart-wrap" role="img" aria-label={props.ariaLabel} onPointerLeave={() => setTip(null)}>
      <div ref={host} />
      {tip && (
        <div
          className="tip show"
          style={{
            left: tip.left + (plot.current?.over.offsetLeft ?? 0),
            top: tip.top + (plot.current?.over.offsetTop ?? 0),
          }}
        >
          {fmt.current(tip.v)}
          <span>{longDate.format(tip.t)}</span>
        </div>
      )}
    </div>
  );
}
