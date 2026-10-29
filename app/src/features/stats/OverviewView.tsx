import { useMemo, useState } from 'react';
import { updateSettings } from '@/data/repositories';
import { dayKey, monthGrid } from '@/domain/dates';
import { formatDurationHuman, formatKg, formatVolume } from '@/domain/format';
import { periodRange, recordsIn, totals } from '@/domain/insights';
import { recentRecords } from '@/domain/records';
import { trainingDays, weeklyAggregates, weekStreak } from '@/domain/stats';
import type { Settings } from '@/domain/types';
import { formatNumber } from '@/domain/units';
import { BarChart } from '@/ui/BarChart';
import { Seg } from '@/ui/components';
import { delta, Kpi, percentDelta, useStatsData } from './parts';

const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const weekFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const dayLetters = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

type WeekValue = ReturnType<typeof weeklyAggregates>[number];

const CHART: Record<Settings['profileChart'], { label: string; pick: (w: WeekValue) => number }> = {
  duration: { label: 'Durée', pick: (w) => w.durationS },
  volume: { label: 'Volume', pick: (w) => w.volumeKg },
  count: { label: 'Séances', pick: (w) => w.count },
};

// Cette méthode permet d'afficher la vue Aperçu : totaux depuis le début, 30 derniers jours comparés aux 30 précédents,
// histogramme hebdomadaire (déplacé du Profil) et calendrier avec la série de semaines.
export default function OverviewView() {
  const { workouts, settings, now } = useStatsData();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const data = useMemo(() => {
    const all = workouts ?? [];
    const r = periodRange('30d', now);
    const prevFrom = r.prevFrom ?? r.from;
    const events = recentRecords(all, Number.POSITIVE_INFINITY);
    return {
      life: totals(all),
      cur: totals(all, r.from, r.to),
      prev: totals(all, prevFrom, r.from),
      records: recordsIn(events, r.from, r.to),
      prevRecords: recordsIn(events, prevFrom, r.from),
      days: trainingDays(all),
      streak: weekStreak(all, now),
      weeks: weeklyAggregates(all, now, 12),
    };
  }, [workouts, now]);

  if (!workouts) return null;
  const { life, cur, prev, weeks } = data;
  const unit = settings.units.weight;
  const hasPrev = prev.count > 0;
  const avg = (t: typeof cur) => (t.count ? t.durationS / t.count : 0);
  const metric = settings.profileChart;
  const values = weeks.map(CHART[metric].pick);

  // Cette méthode permet d'afficher une valeur hebdomadaire selon la mesure choisie (durée, volume ou séances).
  const format = (v: number) =>
    metric === 'duration'
      ? formatDurationHuman(v)
      : metric === 'volume'
        ? formatKg(v, unit, 0)
        : `${v} séance${v > 1 ? 's' : ''}`;

  const grid = monthGrid(month.y, month.m);
  const today = dayKey(now);
  const current = new Date(now);
  const isCurrent = month.y === current.getFullYear() && month.m === current.getMonth();

  // Cette méthode permet de passer au mois précédent ou suivant du calendrier (pas au-delà du mois en cours).
  const shift = (d: -1 | 1) =>
    setMonth(({ y, m }) => {
      const next = new Date(y, m + d, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });

  return (
    <>
      {life.count === 0 ? (
        <p className="empty">Termine ta première séance pour voir tes statistiques.</p>
      ) : (
        <>
          <div className="section">
            <div className="section-title">
              Depuis le début
              {life.firstAt !== undefined && (
                <span className="normal-case fw-600 muted fs-12">{monthFmt.format(life.firstAt)}</span>
              )}
            </div>
            <div className="card">
              <div className="st-totals">
                <Total v={formatNumber(life.count, 0)} k={`séance${life.count > 1 ? 's' : ''}`} />
                <Total v={`${formatNumber(Math.round(life.durationS / 3600), 0)} h`} k="d'entraînement" />
                <Total v={formatVolume(life.volumeKg, unit)} k="soulevés" />
                <Total v={formatNumber(life.sets, 0)} k="séries" />
                <Total v={formatNumber(life.reps, 0)} k="reps" />
                <Total v={formatNumber(life.exercises, 0)} k="exercices" />
              </div>
            </div>
          </div>
          <div className="section">
            <div className="section-title">
              30 derniers jours<span className="normal-case fw-600 muted fs-12">vs 30 précédents</span>
            </div>
            <div className="st-kpis">
              <Kpi
                label="Séances"
                value={cur.count}
                delta={delta(cur.count, hasPrev ? prev.count : undefined, String)}
              />
              <Kpi
                label="Durée moyenne"
                value={cur.count ? formatDurationHuman(avg(cur)) : '—'}
                delta={
                  cur.count
                    ? delta(
                        avg(cur),
                        hasPrev ? avg(prev) : undefined,
                        (s) => `${Math.round(s / 60)} min`,
                        false,
                      )
                    : undefined
                }
              />
              <Kpi
                label="Volume"
                value={formatVolume(cur.volumeKg, unit)}
                delta={percentDelta(cur.volumeKg, prev.volumeKg, hasPrev)}
              />
              <Kpi
                label="Records"
                value={data.records}
                delta={delta(data.records, hasPrev ? data.prevRecords : undefined, String)}
              />
            </div>
          </div>
        </>
      )}
      <div className="section">
        <div className="card">
          <div className="muted fs-13">{CHART[metric].label} · cette semaine</div>
          <div className="hero compact">{format(values.at(-1) ?? 0)}</div>
          <BarChart
            values={values}
            labels={weeks.map((w) => `sem. du ${weekFmt.format(w.weekStart)}`)}
            format={format}
            firstLabel={weeks[0] ? weekFmt.format(weeks[0].weekStart) : ''}
            lastLabel="cette semaine"
            ariaLabel={`${CHART[metric].label} par semaine`}
          />
          <div className="mt-10">
            <Seg
              stretch
              value={metric}
              onChange={(profileChart) => void updateSettings({ profileChart })}
              options={[
                { value: 'duration', label: 'Durée' },
                { value: 'volume', label: 'Volume' },
                { value: 'count', label: 'Séances' },
              ]}
            />
          </div>
        </div>
      </div>
      <div className="section">
        <div className="card">
          <div className="flex justify-between items-center mb-12">
            <div className="flex items-center gap-4">
              <button className="icon-btn" aria-label="Mois précédent" onClick={() => shift(-1)}>
                ‹
              </button>
              <b className="capitalize">{monthFmt.format(new Date(month.y, month.m, 1))}</b>
              <button
                className="icon-btn"
                aria-label="Mois suivant"
                disabled={isCurrent}
                onClick={() => shift(1)}
              >
                {isCurrent ? '' : '›'}
              </button>
            </div>
            <span className="pr-pill c-text">
              🔥 {data.streak} semaine{data.streak > 1 ? 's' : ''}
            </span>
          </div>
          <div className="cal">
            {dayLetters.map((d, i) => (
              <div key={`h${i}`} className="h">
                {d}
              </div>
            ))}
            {grid.flat().map((key, i) =>
              key ? (
                <div
                  key={key}
                  className={`c${data.days.has(key) ? ' on' : ''}${key === today ? ' today' : ''}${key > today ? ' fut' : ''}`}
                >
                  {Number(key.slice(8))}
                </div>
              ) : (
                <div key={`e${i}`} />
              ),
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Cette méthode permet d'afficher un total depuis le début (valeur et libellé).
function Total(props: { v: string; k: string }) {
  return (
    <div>
      <div className="v">{props.v}</div>
      <div className="k">{props.k}</div>
    </div>
  );
}
