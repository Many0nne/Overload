import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router';
import type { StatsPeriod } from '@/domain/insights';
import { Chips, Seg, SubHead } from '@/ui/components';

const OverviewView = lazy(() => import('./OverviewView'));
const MusclesView = lazy(() => import('./MusclesView'));
const ProgressView = lazy(() => import('./ProgressView'));
const SessionsView = lazy(() => import('./SessionsView'));

type View = 'apercu' | 'muscles' | 'progres' | 'seances';

const VIEWS: { value: View; label: string }[] = [
  { value: 'apercu', label: 'Aperçu' },
  { value: 'muscles', label: 'Muscles' },
  { value: 'progres', label: 'Progrès' },
  { value: 'seances', label: 'Séances' },
];

const PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: '30d', label: '30 j' },
  { value: '3m', label: '3 mois' },
  { value: '1y', label: '1 an' },
  { value: 'all', label: 'Tout' },
];

// Cette méthode permet d'afficher les statistiques globales en 4 vues (§F7.6, issue #103) : Aperçu, Muscles, Progrès, Séances.
// La vue et la période (commune aux vues thématiques, 30 jours par défaut) sont gardées dans l'URL pour le retour arrière.
export default function StatsPage() {
  const [params, setParams] = useSearchParams();
  const view = VIEWS.find((v) => v.value === params.get('vue'))?.value ?? 'apercu';
  const period = PERIODS.find((p) => p.value === params.get('periode'))?.value ?? '30d';

  // Cette méthode permet de changer de vue ou de période sans empiler d'entrée d'historique.
  const update = (next: { vue?: View; periode?: StatsPeriod }) => {
    const v = next.vue ?? view;
    const p = next.periode ?? period;
    const search: Record<string, string> = {};
    if (v !== 'apercu') search.vue = v;
    if (p !== '30d') search.periode = p;
    setParams(search, { replace: true });
  };

  return (
    <>
      <SubHead title="Statistiques" />
      <div className="section mt-4 st-tabs">
        <Seg stretch value={view} options={VIEWS} onChange={(vue) => update({ vue })} />
      </div>
      {view !== 'apercu' && (
        <div className="mt-12">
          <Chips value={period} options={PERIODS} onChange={(p) => p && update({ periode: p })} />
        </div>
      )}
      <Suspense fallback={null}>
        {view === 'apercu' && <OverviewView />}
        {view === 'muscles' && <MusclesView period={period} />}
        {view === 'progres' && <ProgressView period={period} />}
        {view === 'seances' && <SessionsView period={period} />}
      </Suspense>
    </>
  );
}
