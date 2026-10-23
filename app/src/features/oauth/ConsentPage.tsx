import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';

// Page de consentement du connecteur Claude (docs/spec-mcp.md §5.4) : publique, chargée à la demande, sans Dexie ni
// synchronisation. La session Supabase n'est pas persistée : elle ne sert que le temps d'approuver ou de refuser.

type Details = {
  authorization_id: string;
  redirect_uri: string;
  client: { id: string; name: string };
  user: { id: string; email: string };
  scope: string;
};

type State =
  | { step: 'loading' }
  | { step: 'login'; error?: string }
  | { step: 'consent'; details: Details }
  | { step: 'redirecting' }
  | { step: 'error'; message: string };

const STORAGE_KEY = 'overload-auth';
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

// Cette méthode permet de créer le client Supabase de la page, sans session persistée ni lecture de l'URL.
function makeClient(): SupabaseClient {
  return createClient(
    (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'http://127.0.0.1:54321',
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? 'missing-anon-key',
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}

// Cette méthode permet de reprendre la session de l'app ouverte dans ce navigateur si son jeton est encore valide,
// sans la rafraîchir (la rotation du jeton de rafraîchissement déconnecterait l'app).
async function reuseAppSession(client: SupabaseClient): Promise<boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw) as { access_token?: string; refresh_token?: string; expires_at?: number };
    if (!s.access_token || !s.refresh_token || !s.expires_at || s.expires_at * 1000 < Date.now() + 60_000)
      return false;
    const { error } = await client.auth.setSession({
      access_token: s.access_token,
      refresh_token: s.refresh_token,
    });
    return !error;
  } catch {
    return false;
  }
}

// Cette méthode permet de lire le domaine de retour d'une URI de redirection (« claude.ai », « localhost »).
function hostOf(uri: string): string {
  try {
    return new URL(uri).hostname;
  } catch {
    return uri;
  }
}

// Cette méthode permet d'afficher la page de consentement : connexion si besoin, client, domaine de retour, droits
// demandés et choix « modifications autorisées », puis approbation ou refus avec retour vers Claude.
export default function ConsentPage() {
  const client = useMemo(makeClient, []);
  const authorizationId = useMemo(() => new URLSearchParams(location.search).get('authorization_id'), []);
  const [state, setState] = useState<State>({ step: 'loading' });
  const [canWrite, setCanWrite] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // Cette méthode permet de charger la demande d'autorisation ; une demande déjà approuvée renvoie aussitôt vers Claude.
  const loadDetails = async () => {
    if (!authorizationId) return;
    const { data, error } = await client.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error || !data)
      return setState({
        step: 'error',
        message:
          "Cette demande d'autorisation a expiré ou n'est plus valide. Relance la connexion depuis Claude.",
      });
    const redirect = (data as { redirect_url?: string }).redirect_url;
    if (redirect) {
      setState({ step: 'redirecting' });
      return location.assign(redirect);
    }
    setState({ step: 'consent', details: data as Details });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: chargement unique à l'ouverture de la page
  useEffect(() => {
    document.title = 'Connecter Claude · Overload';
    if (!authorizationId) {
      setState({
        step: 'error',
        message: "Lien d'autorisation incomplet. Relance la connexion depuis Claude.",
      });
      return;
    }
    void reuseAppSession(client).then((ok) => (ok ? loadDetails() : setState({ step: 'login' })));
  }, []);

  // Cette méthode permet de se connecter le temps du consentement, puis de charger la demande.
  const signIn = async () => {
    setBusy(true);
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error)
      return setState({
        step: 'login',
        error: error.message.includes('Invalid login') ? 'E-mail ou mot de passe incorrect.' : error.message,
      });
    setState({ step: 'loading' });
    await loadDetails();
  };

  // Cette méthode permet de changer de compte : la session temporaire est fermée et le formulaire réaffiché.
  const switchAccount = async () => {
    await client.auth.signOut({ scope: 'local' });
    setPassword('');
    setState({ step: 'login' });
  };

  // Cette méthode permet d'enregistrer le choix « modifications autorisées » puis d'approuver : Supabase renvoie vers Claude.
  const approve = async (details: Details) => {
    setBusy(true);
    const saved = await client.rpc('upsert_mcp_connection', {
      p_client_id: details.client.id,
      p_client_name: details.client.name,
      p_can_write: canWrite,
    });
    if (saved.error) {
      setBusy(false);
      return setState({
        step: 'error',
        message: 'Enregistrement impossible. Vérifie la connexion et réessaie.',
      });
    }
    const { data, error } = await client.auth.oauth.approveAuthorization(details.authorization_id, {
      skipBrowserRedirect: true,
    });
    if (error || !data) {
      setBusy(false);
      return setState({
        step: 'error',
        message: "L'autorisation a échoué. Relance la connexion depuis Claude.",
      });
    }
    setState({ step: 'redirecting' });
    location.assign((data as { redirect_url: string }).redirect_url);
  };

  // Cette méthode permet de refuser : Supabase renvoie vers Claude avec un refus.
  const deny = async (details: Details) => {
    setBusy(true);
    const { data, error } = await client.auth.oauth.denyAuthorization(details.authorization_id, {
      skipBrowserRedirect: true,
    });
    if (error || !data) {
      setBusy(false);
      return setState({
        step: 'error',
        message: 'Refus impossible à transmettre. Tu peux fermer cette page.',
      });
    }
    setState({ step: 'redirecting' });
    location.assign((data as { redirect_url: string }).redirect_url);
  };

  return (
    <div className="page no-tab center-page" data-testid="consent-page">
      <div className="brand" style={{ paddingTop: 40 }}>
        <span className="logo">O</span>
        <h2>Connecter Claude</h2>
        <p>Autoriser un assistant à accéder à ton compte Overload.</p>
      </div>

      {state.step === 'loading' && (
        <p className="t2" style={{ textAlign: 'center' }}>
          Chargement…
        </p>
      )}
      {state.step === 'redirecting' && (
        <p className="t2" style={{ textAlign: 'center' }}>
          Retour vers Claude…
        </p>
      )}
      {state.step === 'error' && (
        <p className="error-text" role="alert" style={{ textAlign: 'center', padding: '0 16px' }}>
          {state.message}
        </p>
      )}

      {state.step === 'login' && (
        <form
          className="section"
          onSubmit={(e) => {
            e.preventDefault();
            void signIn();
          }}
        >
          <p className="t2" style={{ padding: '0 0 12px', fontSize: '.875rem' }}>
            Connecte-toi avec ton compte Overload pour continuer.
          </p>
          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="field">
            <span>Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {state.error && <p className="error-text">{state.error}</p>}
          <button
            type="submit"
            className="btn btn-primary btn-block"
            style={{ marginTop: 20, height: 52 }}
            disabled={busy}
          >
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      )}

      {state.step === 'consent' && (
        <ConsentForm
          details={state.details}
          canWrite={canWrite}
          onCanWrite={setCanWrite}
          busy={busy}
          onApprove={() => void approve(state.details)}
          onDeny={() => void deny(state.details)}
          onSwitchAccount={() => void switchAccount()}
        />
      )}
    </div>
  );
}

// Cette méthode permet d'afficher le détail de la demande : client, domaine de retour, droits, choix d'écriture et boutons.
function ConsentForm(props: {
  details: Details;
  canWrite: boolean;
  onCanWrite: (v: boolean) => void;
  busy: boolean;
  onApprove: () => void;
  onDeny: () => void;
  onSwitchAccount: () => void;
}) {
  const { details } = props;
  const host = hostOf(details.redirect_uri);
  const loopback = LOOPBACK.has(host);
  return (
    <div className="section">
      <div className="card" style={{ padding: 16 }}>
        <p style={{ fontSize: '1rem', lineHeight: 1.5 }}>
          <b>{details.client.name || 'Une application'}</b> demande l'accès à ton compte Overload.
        </p>
        <p className="t2" style={{ marginTop: 6, fontSize: '.875rem' }}>
          Retour vers <b data-testid="consent-host">{host}</b>
        </p>
        {loopback && (
          <p
            role="alert"
            style={{ marginTop: 10, color: 'var(--warm)', fontSize: '.875rem', lineHeight: 1.45 }}
          >
            Ne continue que si tu viens de lancer Claude Code sur cet ordinateur.
          </p>
        )}
      </div>

      <div className="section-title" style={{ marginTop: 16 }}>
        Ce que Claude pourra faire
      </div>
      <ul className="t2" style={{ margin: '0 0 0 18px', fontSize: '.875rem', lineHeight: 1.6 }}>
        <li>Lire tes séances, routines, records, statistiques et mesures.</li>
        <li>
          Si tu l'autorises : créer ou modifier des routines, des séances passées, des mesures et des
          objectifs.
        </li>
        <li>Jamais tes photos, ton e-mail ni tes séances en cours.</li>
      </ul>

      <label className="set-row" style={{ marginTop: 12, cursor: 'pointer' }}>
        Autoriser Claude à modifier mes données
        <input
          type="checkbox"
          checked={props.canWrite}
          onChange={(e) => props.onCanWrite(e.target.checked)}
          style={{ width: 22, height: 22 }}
        />
      </label>

      <p className="t2" style={{ marginTop: 12, fontSize: '.8125rem', lineHeight: 1.5 }}>
        Les données lues par Claude sont transmises à Anthropic, dans le cadre de ton compte Claude. Tu
        pourras déconnecter Claude à tout moment dans Paramètres › Claude.
      </p>

      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 20, height: 52 }}
        disabled={props.busy}
        onClick={props.onApprove}
      >
        Autoriser
      </button>
      <button
        className="btn btn-block"
        style={{ marginTop: 10, height: 48 }}
        disabled={props.busy}
        onClick={props.onDeny}
      >
        Refuser
      </button>
      <button type="button" className="link-c" onClick={props.onSwitchAccount}>
        Connecté en tant que {details.user.email} · Changer de compte
      </button>
    </div>
  );
}
