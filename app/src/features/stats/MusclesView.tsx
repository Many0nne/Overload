import { useMemo, useState } from 'react';
import { heatHighlights } from '@/domain/bodyMap';
import { formatVolume } from '@/domain/format';
import { muscleBalance, muscleVolume, periodRange, type StatsPeriod } from '@/domain/insights';
import { MUSCLE_LABELS } from '@/domain/labels';
import { muscleDistribution } from '@/domain/stats';
import type { Muscle } from '@/domain/types';
import { formatNumber } from '@/domain/units';
import { BodyHeatMap } from '@/ui/BodyMap';
import { Seg } from '@/ui/components';
import { useStatsData } from './parts';

type Metric = 'sets' | 'volume';

// Cette méthode permet d'afficher la vue Muscles sur la période : carte musculaire colorée selon les séries, séries ou volume
// par muscle, équilibres pousser/tirer et haut/bas (en séries).
export default function MusclesView(props: { period: StatsPeriod }) {
  const { workouts, exercises, settings, now } = useStatsData();
  const [metric, setMetric] = useState<Metric>('sets');

  const data = useMemo(() => {
    const all = workouts ?? [];
    const r = periodRange(props.period, now);
    const info = (id: string) => exercises.get(id);
    const sets = muscleDistribution(all, info, r.from, r.to);
    return {
      sets,
      volume: muscleVolume(all, info, r.from, r.to),
      heat: heatHighlights(sets),
      balance: muscleBalance(sets),
    };
  }, [workouts, exercises, props.period, now]);

  if (!workouts) return null;
  const dist = metric === 'sets' ? data.sets : data.volume;
  const list = (Object.entries(dist) as [Muscle, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const hasSets = Object.values(data.sets).some((v) => v > 0);
  const max = list[0]?.[1] ?? 1;
  const unit = settings.units.weight;
  const value = (v: number) => (metric === 'sets' ? formatNumber(v) : formatVolume(v, unit));

  if (!hasSets) return <p className="empty">Aucune série sur la période.</p>;

  return (
    <>
      <div className="section">
        <BodyHeatMap levels={data.heat} label="Carte des muscles travaillés sur la période" />
        <div className="st-scale" aria-hidden="true">
          moins <i /> <i style={{ opacity: 0.25 }} /> <i style={{ opacity: 0.45 }} />{' '}
          <i style={{ opacity: 0.7 }} /> <i /> plus
        </div>
      </div>
      <div className="section">
        <div className="section-title">
          Par muscle
          <Seg
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'sets', label: 'Séries' },
              { value: 'volume', label: 'Volume' },
            ]}
          />
        </div>
        <div className="card">
          {list.length === 0 && <p className="muted">Aucune série chargée sur la période.</p>}
          {list.map(([m, v]) => (
            <div key={m} className="hbar wide">
              <span>{MUSCLE_LABELS[m]}</span>
              <div className="track">
                <div className="fill" style={{ width: `${(v / max) * 100}%` }} />
              </div>
              <span className="n">{value(v)}</span>
            </div>
          ))}
        </div>
        <p className="muted fs-12 mt-6">
          {metric === 'sets'
            ? 'Muscle principal = 1 série, secondaire = 0,5.'
            : 'Volume réparti comme les séries : principal 100 %, secondaire 50 %.'}
        </p>
      </div>
      {(data.balance.push !== undefined || data.balance.upper !== undefined) && (
        <div className="section">
          <div className="section-title">
            Équilibres<span className="normal-case fw-600 muted fs-12">en séries</span>
          </div>
          <div className="card">
            {data.balance.push !== undefined && <Balance a="Pousser" b="Tirer" share={data.balance.push} />}
            {data.balance.upper !== undefined && <Balance a="Haut" b="Bas" share={data.balance.upper} />}
          </div>
        </div>
      )}
    </>
  );
}

// Cette méthode permet d'afficher un équilibre entre deux groupes de muscles (part du premier, entre 0 et 1).
function Balance(props: { a: string; b: string; share: number }) {
  const pa = Math.round(props.share * 100);
  return (
    <div className="st-balance">
      <span>
        {props.a}
        <b>{pa} %</b>
      </span>
      <div className="st-stack" role="img" aria-label={`${props.a} ${pa} %, ${props.b} ${100 - pa} %`}>
        <span className="a" style={{ width: `${pa}%` }} />
        <span className="b" style={{ width: `${100 - pa}%` }} />
      </div>
      <span className="r">
        {props.b}
        <b>{100 - pa} %</b>
      </span>
    </div>
  );
}
