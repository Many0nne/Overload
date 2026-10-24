import { lazy, type ReactNode, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router';
import { initAuth } from '@/data/auth';
import { deviceIdSync } from '@/data/device';
import { useExercise, useInProgressWorkouts, useSettings } from '@/data/queries';
import { useSession } from '@/data/session';
import { useStorageUsage } from '@/data/storageUsage';
import { useSyncStatus } from '@/data/sync/status';
import { formatClockSkew, isClockSkewed } from '@/domain/clock';
import { currentExerciseId } from '@/domain/current';
import { formatClock } from '@/domain/format';
import { isStorageNearQuota } from '@/domain/quota';
import { Sheet, ToastHost } from '@/ui/components';
import { ErrorBoundary, PageBoundary } from '@/ui/ErrorBoundary';
import { DumbbellIcon, HomeIcon, TrashIcon, UserIcon } from '@/ui/icons';
import { isIos, isStandalone } from '@/ui/platform';
import { useNow } from '@/ui/useNow';

// Écrans publics en lazy : absents du JS initial d'un utilisateur déjà connecté (budget §15).
const auth = () => import('@/features/auth/AuthScreens');
const InstallPage = lazy(() => auth().then((m) => ({ default: m.InstallPage })));
const InvitePage = lazy(() => auth().then((m) => ({ default: m.InvitePage })));
const LoginPage = lazy(() => auth().then((m) => ({ default: m.LoginPage })));
const ResetPage = lazy(() => auth().then((m) => ({ default: m.ResetPage })));
const SignupPage = lazy(() => auth().then((m) => ({ default: m.SignupPage })));

const HomePage = lazy(() => import('@/features/home/HomePage'));
const SeancePage = lazy(() => import('@/features/routines/SeancePage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));
const WelcomePage = lazy(() => import('@/features/onboarding/WelcomePage'));
const LiveWorkoutPage = lazy(() => import('@/features/workout-live/LiveWorkoutPage'));
const SummaryPage = lazy(() => import('@/features/workout-summary/SummaryPage'));
const HistoryDetailPage = lazy(() => import('@/features/history/HistoryDetailPage'));
const ExercisePage = lazy(() => import('@/features/exercise/ExercisePage'));
// Consentement du connecteur Claude : page publique hors Dexie et hors synchronisation (docs/spec-mcp.md §5.4).
const ConsentPage = lazy(() => import('@/features/oauth/ConsentPage'));
const CONSENT_PATH = '/oauth/consent';
// Enregistrement du service worker (workbox-window) chargé juste après le démarrage, hors du JS initial (budget §15).
const UpdatePrompt = lazy(() => import('@/ui/UpdatePrompt').then((m) => ({ default: m.UpdatePrompt })));

// Cette méthode permet d'appliquer le thème choisi (sombre par défaut, auto = selon le système) sur <html>.
function useTheme() {
  const { theme } = useSettings();
  useEffect(() => {
    const apply = () => {
      const dark =
        theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#000000' : '#ffffff');
    };
    apply();
    if (theme !== 'auto') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

// Cette méthode permet d'afficher le bandeau « Séance en cours » au-dessus des onglets, depuis n'importe quel écran (§F7.4, §F7.9).
function WorkoutBanner() {
  const workouts = useInProgressWorkouts();
  const navigate = useNavigate();
  const now = useNow(1000);
  const mine = workouts?.find((w) => w.owner_device_id === deviceIdSync());
  const other = workouts?.find((w) => w.owner_device_id !== deviceIdSync());
  const w = mine ?? other;
  const exercise = useExercise(w ? currentExerciseId(w.doc) : undefined);
  const [confirm, setConfirm] = useState(false);
  if (!w) return null;

  // Cette méthode permet d'abandonner la séance de cet appareil depuis le bandeau, sans rien conserver.
  // Minuteur et écriture sont chargés à la demande pour rester hors du JS initial (budget §15).
  const discard = async () => {
    setConfirm(false);
    const { useRestTimer } = await import('@/features/workout-live/restTimer');
    await useRestTimer.getState().skip();
    const { deleteWorkout } = await import('@/data/repositories');
    await deleteWorkout(w.id);
  };

  return (
    <>
      <div className={`banner${mine ? '' : ' other'}`}>
        <button className="banner-main" onClick={() => navigate(`/workout/${w.id}`)}>
          <span className="banner-title">
            <span className="dot-live" />
            {mine ? 'Séance en cours' : 'Séance en cours sur un autre appareil'}
            <b>{formatClock(Math.max(0, now - w.started_at) / 1000)}</b>
          </span>
          <span className="banner-sub">{exercise?.name ?? 'Aucun exercice'}</span>
        </button>
        {mine && (
          <button
            className="banner-discard"
            aria-label="Abandonner la séance"
            onClick={() => setConfirm(true)}
          >
            <TrashIcon />
          </button>
        )}
      </div>
      <Sheet
        open={confirm}
        title="Abandonner la séance ?"
        onClose={() => setConfirm(false)}
        actions={[
          { label: 'Abandonner', kind: 'danger', onClick: () => void discard() },
          { label: 'Continuer la séance', onClick: () => setConfirm(false) },
        ]}
      >
        <p>Rien ne sera conservé.</p>
      </Sheet>
    </>
  );
}

// Cette méthode permet d'afficher la barre d'onglets Accueil / Séance / Profil (§F8).
function TabBar() {
  return (
    <nav className="tabbar">
      <NavLink to="/" end>
        <HomeIcon />
        Accueil
      </NavLink>
      <NavLink to="/seance">
        <DumbbellIcon />
        Séance
      </NavLink>
      <NavLink to="/profile">
        <UserIcon />
        Profil
      </NavLink>
    </nav>
  );
}

// Cette méthode permet d'habiller un écran à onglets : contenu, bandeau de séance et barre d'onglets.
// Une erreur de rendu reste confinée au contenu : bandeau et onglets restent utilisables.
function TabShell(props: { children: ReactNode }) {
  return (
    <>
      <main className="page with-banner">
        <PageBoundary scope="page">{props.children}</PageBoundary>
      </main>
      <ErrorBoundary scope="banner" fallback={null}>
        <WorkoutBanner />
      </ErrorBoundary>
      <TabBar />
    </>
  );
}

// Cette méthode permet de router l'utilisateur connecté vers les écrans de l'app.
function SignedInRoutes() {
  return (
    <Suspense fallback={<div className="page" />}>
      <Routes>
        <Route
          path="/"
          element={
            <TabShell>
              <HomePage />
            </TabShell>
          }
        />
        <Route
          path="/seance/*"
          element={
            <TabShell>
              <SeancePage />
            </TabShell>
          }
        />
        <Route
          path="/profile/*"
          element={
            <TabShell>
              <ProfilePage />
            </TabShell>
          }
        />
        <Route
          path="/history/:id"
          element={
            <TabShell>
              <HistoryDetailPage />
            </TabShell>
          }
        />
        <Route
          path="/exercise/:id"
          element={
            <TabShell>
              <ExercisePage />
            </TabShell>
          }
        />
        <Route
          path="/workout/:id"
          element={
            <PageBoundary scope="page" workout>
              <LiveWorkoutPage />
            </PageBoundary>
          }
        />
        <Route
          path="/workout/:id/summary"
          element={
            <PageBoundary scope="page">
              <SummaryPage />
            </PageBoundary>
          }
        />
        <Route
          path="/welcome"
          element={
            <PageBoundary scope="page">
              <WelcomePage />
            </PageBoundary>
          }
        />
        <Route path="/reset" element={<ResetPage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/signup" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

// Cette méthode permet de router un visiteur non connecté (invitation, inscription, connexion, réinitialisation).
function SignedOutRoutes() {
  return (
    <Routes>
      <Route path="/i/:code" element={<InvitePage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset" element={<ResetPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

// Cette méthode permet de choisir entre la page d'installation (Safari iOS), les écrans publics et l'app.
function Root() {
  const status = useSession((s) => s.status);
  const needsReauth = useSession((s) => s.needsReauth);
  const location = useLocation();
  const [browserOk, setBrowserOk] = useState(() => sessionStorage.getItem('browser-ok') === '1');
  useTheme();

  const publicPath = location.pathname.startsWith('/i/') || location.pathname === '/reset';
  if (isIos() && !isStandalone() && !publicPath && !browserOk) {
    return (
      <InstallPage
        onContinue={() => {
          sessionStorage.setItem('browser-ok', '1');
          setBrowserOk(true);
        }}
      />
    );
  }
  if (status === 'loading') return <div className="page" />;
  if (status === 'signed_out') return <SignedOutRoutes />;
  return (
    <>
      <TopNotices showReauth={needsReauth && location.pathname !== '/login'} />
      <Suspense fallback={null}>
        <UpdatePrompt />
      </Suspense>
      <SignedInRoutes />
    </>
  );
}

// Cette méthode permet d'empiler en haut à droite les pastilles d'alerte (reconnexion, horloge décalée, quota admin).
function TopNotices(props: { showReauth: boolean }) {
  const clockSkewMs = useSyncStatus((s) => s.clockSkewMs);
  const skewed = isClockSkewed(clockSkewMs);
  const { usedBytes, quotaBytes } = useStorageUsage();
  const nearQuota = isStorageNearQuota(usedBytes, quotaBytes);
  const navigate = useNavigate();
  if (!props.showReauth && !skewed && !nearQuota) return null;
  return (
    <div className="top-notices">
      {props.showReauth && <ReauthNotice />}
      {skewed && clockSkewMs !== null && <ClockNotice skewMs={clockSkewMs} />}
      {nearQuota && usedBytes !== null && (
        <button
          className="tag"
          style={{ color: 'var(--warm)' }}
          onClick={() => navigate('/profile/settings')}
        >
          Stockage {Math.floor((usedBytes / quotaBytes) * 100)} %
        </button>
      )}
    </div>
  );
}

// Cette méthode permet de signaler une session expirée sans bloquer l'usage hors ligne (§6.6).
function ReauthNotice() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="tag" style={{ color: 'var(--warm)' }} onClick={() => setOpen(true)}>
        Reconnexion requise
      </button>
      <Sheet open={open} label="Reconnexion" onClose={() => setOpen(false)}>
        <LoginPage />
      </Sheet>
    </>
  );
}

// Cette méthode permet de prévenir que l'horloge de l'appareil s'écarte de plus de 5 min de l'heure serveur :
// « dernier gagne » pourrait alors garder la mauvaise version d'une donnée modifiée sur deux appareils (§19).
function ClockNotice(props: { skewMs: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="tag" style={{ color: 'var(--warm)' }} onClick={() => setOpen(true)}>
        Horloge décalée
      </button>
      <Sheet
        open={open}
        title="Horloge décalée"
        onClose={() => setOpen(false)}
        actions={[{ label: 'Compris', kind: 'primary', onClick: () => setOpen(false) }]}
      >
        <p>
          L'heure de cet appareil est {formatClockSkew(props.skewMs)} sur celle du serveur. Quand une même
          donnée est modifiée sur deux appareils, c'est la modification la plus récente selon l'horloge de
          chaque appareil qui est gardée : un écart peut faire perdre la bonne version.
        </p>
        <p style={{ marginTop: 8 }}>
          Active le réglage automatique de la date et de l'heure dans les réglages du téléphone.
        </p>
      </Sheet>
    </>
  );
}

// Cette méthode permet de démarrer l'app, ou seulement la page de consentement OAuth sans base locale ni synchro.
export function App() {
  if (location.pathname === CONSENT_PATH)
    return (
      <div className="app">
        <Suspense fallback={<div className="page" />}>
          <ConsentPage />
        </Suspense>
      </div>
    );
  return <MainApp />;
}

// Cette méthode permet de préparer la session (base locale, synchro) puis d'afficher l'app.
function MainApp() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void initAuth().finally(() => setReady(true));
  }, []);
  if (!ready) return null;
  return (
    <BrowserRouter>
      <div className="app">
        <Suspense fallback={<div className="page" />}>
          <Root />
        </Suspense>
        <ToastHost />
      </div>
    </BrowserRouter>
  );
}
