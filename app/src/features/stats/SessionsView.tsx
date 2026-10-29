import { useMemo } from 'react';
import { useRoutines } from '@/data/queries';
import { formatDurationHuman } from '@/domain/format';
import {
  averageRpe,
  MIN_SESSIONS_FOR_ZONES,
  periodRange,
  repZones,
  routineUsage,
  type StatsPeriod,
  setKindSplit,
  totals,
} from '@/domain/insights';
import { formatNumber } from '@/domain/units';
import { delta, Kpi, SettingsHint, Stack, useStatsData, Waiting } from './parts';

// Cette méthode permet d'afficher la vue Séances sur la période : durée et RPE moyens (écarts à la période précédente),
// types de séries, zones de répétitions et routines les plus utilisées.
export default function SessionsView(props: { period: StatsPeriod }) {
  const { workouts, settings, now } = useStatsData();
  const routines = useRoutines();

  const data = useMemo(() => {
    const all = workouts ?? [];
    const r = periodRange(props.period, now);
    const prevFrom = r.prevFrom;
    return {
      cur: totals(all, r.from, r.to),
      prev: prevFrom === undefined ? undefined : totals(all, prevFrom, r.from),
      rpe: averageRpe(all, r.from, r.to),
      prevRpe: prevFrom === undefined ? undefined : averageRpe(all, prevFrom, r.from),
      kinds: setKindSplit(all, r.from, r.to),
      zones: repZones(all, r.from, r.to),
      routines: routineUsage(all, r.from, r.to).slice(0, 5),
    };
  }, [workouts, props.period, now]);

  if (!workouts) return null;
  const { cur, prev, rpe, kinds, zones } = data;
  if (cur.count === 0) return <p className="empty">Aucune séance sur la période.</p>;

  const hasPrev = prev !== undefined && prev.count > 0;
  const avg = (t: typeof cur) => t.durationS / t.count;
  const zoneTotal = zones.strength + zones.hypertrophy + zones.endurance;
  const names = new Map((routines ?? []).map((r) => [r.id, r.doc.name]));

  return (
    <>
      <div className="section">
        <div className="st-kpis">
          <Kpi
            label="Durée moyenne"
            value={formatDurationHuman(avg(cur))}
            delta={delta(
              avg(cur),
              hasPrev ? avg(prev) : undefined,
              (s) => `${Math.round(s / 60)} min`,
              false,
            )}
          />
          {rpe ? (
            <Kpi
              label="RPE moyen"
              value={formatNumber(rpe.avg)}
              delta={delta(
                Math.round(rpe.avg * 10) / 10,
                data.prevRpe && hasPrev ? Math.round(data.prevRpe.avg * 10) / 10 : undefined,
                (v) => formatNumber(v),
                false,
              )}
            />
          ) : (
            <Kpi
              label="Séances"
              value={cur.count}
              delta={delta(cur.count, hasPrev ? prev.count : undefined, String)}
            />
          )}
        </div>
      </div>
      <div className="section">
        <div className="section-title">Types de séries</div>
        <div className="card">
          <Stack
            label="Répartition des séries par type"
            parts={[
              { key: 'normal', label: 'Normales', n: kinds.normal, cls: 'st-c-normal' },
              { key: 'warmup', label: 'Échauffement', n: kinds.warmup, cls: 'st-c-warmup' },
              { key: 'drop', label: 'Dégressives', n: kinds.drop, cls: 'st-c-drop' },
              { key: 'failure', label: 'Échec', n: kinds.failure, cls: 'st-c-failure' },
            ]}
          />
        </div>
      </div>
      <div className="section">
        <div className="section-title">Zones de répétitions</div>
        <div className="card">
          {cur.count < MIN_SESSIONS_FOR_ZONES ? (
            <Waiting
              have={cur.count}
              need={MIN_SESSIONS_FOR_ZONES}
              what={`La répartition s'affiche à partir de ${MIN_SESSIONS_FOR_ZONES} séances sur la période.`}
            />
          ) : zoneTotal === 0 ? (
            <p className="muted">Aucune série chargée sur la période.</p>
          ) : (
            <>
              <Stack
                label="Répartition des séries par zone de répétitions"
                parts={[
                  { key: 'z1', label: '1-5 reps', n: zones.strength, cls: 'st-c-zone1' },
                  { key: 'z2', label: '6-12 reps', n: zones.hypertrophy, cls: 'st-c-zone2' },
                  { key: 'z3', label: '13+ reps', n: zones.endurance, cls: 'st-c-zone3' },
                ]}
              />
              <p className="muted fs-12 mt-6">
                Séries de travail chargées (poids et reps, lesté), hors échauffement et dégressives.
              </p>
            </>
          )}
        </div>
      </div>
      <div className="section">
        <div className="section-title">Routines les plus utilisées</div>
        <div className="card">
          {data.routines.map((u) => (
            <div key={u.routineId ?? 'libre'} className="st-row">
              <span>{u.routineId === null ? 'Séances libres' : (names.get(u.routineId) ?? u.lastTitle)}</span>
              <b>
                {u.count} séance{u.count > 1 ? 's' : ''}
              </b>
            </div>
          ))}
        </div>
        {!rpe && !settings.rpeEnabled && (
          <SettingsHint>RPE désactivé : le RPE moyen apparaîtra ici si tu l'actives dans</SettingsHint>
        )}
      </div>
    </>
  );
}
