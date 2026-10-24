import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, useMemo } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import { db } from '@/data/db';
import { useCompletedWorkouts, useProfile, useSettings } from '@/data/queries';
import { updateSettings } from '@/data/repositories';
import { formatDurationHuman, formatKg, formatWeight } from '@/domain/format';
import { weeklyAggregates } from '@/domain/stats';
import type { Settings } from '@/domain/types';
import { ExerciseList } from '@/features/library/ExerciseList';
import { BarChart } from '@/ui/BarChart';
import { Seg, SubHead, toast } from '@/ui/components';
import { SyncPill } from '@/ui/SyncPill';

const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const ErrorLogPage = lazy(() => import('@/features/settings/ErrorLogPage'));
const ImportHevyPage = lazy(() => import('@/features/settings/ImportHevyPage'));
const ClaudePage = lazy(() => import('@/features/settings/ClaudePage'));
const StatsPage = lazy(() => import('@/features/stats/StatsPage'));
const MeasurementsPage = lazy(() => import('@/features/measurements/MeasurementsPage'));

const weekFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

// Cette méthode permet de router les écrans de l'onglet Profil (profil, statistiques, mesures, exercices, paramètres).
export default function ProfilePage() {
  return (
    <Routes>
      <Route index element={<ProfileHome />} />
      <Route path="stats" element={<StatsPage />} />
      <Route path="measurements" element={<MeasurementsPage />} />
      <Route path="exercises" element={<ExercisesIndex />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="settings/errors" element={<ErrorLogPage />} />
      <Route path="settings/import-hevy" element={<ImportHevyPage />} />
      <Route path="settings/claude" element={<ClaudePage />} />
    </Routes>
  );
}

const CHART: Record<
  Settings['profileChart'],
  { label: string; pick: (w: ReturnType<typeof weeklyAggregates>[number]) => number }
> = {
  duration: { label: 'Durée', pick: (w) => w.durationS },
  volume: { label: 'Volume', pick: (w) => w.volumeKg },
  count: { label: 'Séances', pick: (w) => w.count },
};

// Cette méthode permet d'afficher le profil : nom, nombre de séances, histogramme hebdomadaire et liens (§F7.1).
function ProfileHome() {
  const navigate = useNavigate();
  const profile = useProfile();
  const settings = useSettings();
  const workouts = useCompletedWorkouts();
  const lastWeight = useLiveQuery(async () => {
    const rows = await db.body_measurements
      .orderBy('measured_on')
      .reverse()
      .filter((r) => r.deleted_at == null)
      .toArray();
    return rows.find((r) => r.values.weight)?.values.weight;
  }, []);
  const metric = settings.profileChart;
  const weeks = useMemo(() => weeklyAggregates(workouts ?? [], Date.now(), 12), [workouts]);

  // Cette méthode permet d'afficher une valeur hebdomadaire selon la mesure choisie (durée, volume ou séances).
  const format = (v: number) =>
    metric === 'duration'
      ? formatDurationHuman(v)
      : metric === 'volume'
        ? formatKg(v, settings.units.weight, 0)
        : `${v} séance${v > 1 ? 's' : ''}`;

  // Cette méthode permet de copier le lien d'invitation personnel (§F7.1).
  const copyInvite = async () => {
    if (!profile) return;
    const link = `${location.origin}/i/${profile.invite_code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast("Lien d'invitation copié");
    } catch {
      toast(link);
    }
  };

  const name = profile?.display_name ?? '';
  const values = weeks.map(CHART[metric].pick);
  const count = workouts?.length ?? 0;

  return (
    <>
      <div className="head">
        <h2>Profil</h2>
        <div className="right">
          <SyncPill />
          <button className="icon-btn" aria-label="Paramètres" onClick={() => navigate('/profile/settings')}>
            <GearIcon />
          </button>
        </div>
      </div>
      <div className="profile">
        <div className="avatar">{(name || '?').charAt(0).toUpperCase()}</div>
        <div>
          <h3>{name}</h3>
          <div className="muted fs-14 mt-2">
            <b className="c-text">{count}</b> séance{count > 1 ? 's' : ''}
          </div>
        </div>
      </div>
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
        <div>
          <button className="row-link" onClick={() => navigate('/profile/stats')}>
            <span className="ico">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
              </svg>
            </span>
            Statistiques<span className="end">›</span>
          </button>
          <button className="row-link" onClick={() => navigate('/profile/exercises')}>
            <span className="ico">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
                <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
              </svg>
            </span>
            Exercices et records<span className="end">›</span>
          </button>
          <button className="row-link" onClick={() => navigate('/profile/measurements')}>
            <span className="ico">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M3 17l6-6 4 4 8-8" />
                <path d="M14 7h7v7" />
              </svg>
            </span>
            Mesures corporelles
            <span className="end">
              {lastWeight ? `${formatWeight(lastWeight, settings.units.weight)} ›` : '›'}
            </span>
          </button>
          <button className="row-link" onClick={() => void copyInvite()}>
            <span className="ico">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
                <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
              </svg>
            </span>
            Inviter un proche<span className="end">Copier ›</span>
          </button>
        </div>
      </div>
    </>
  );
}

// Cette méthode permet de parcourir tous les exercices pour ouvrir leur fiche (records, graphiques).
function ExercisesIndex() {
  const navigate = useNavigate();
  return (
    <>
      <SubHead title="Exercices et records" />
      <ExerciseList archivable onPick={(e) => navigate(`/exercise/${e.id}`)} />
    </>
  );
}

// Cette méthode permet d'afficher l'icône d'engrenage des paramètres.
function GearIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
