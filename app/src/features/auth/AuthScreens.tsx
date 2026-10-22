import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { requestPasswordReset, signIn, signUpWithInvite, updatePassword } from '@/data/auth';
import { supabase } from '@/data/supabase';
import { TRAINING_AGE_LABELS } from '@/domain/labels';
import { DEFAULT_SETTINGS, type Settings, type TrainingAgeBucket } from '@/domain/types';
import { Chips, Seg, toast } from '@/ui/components';
import { formatInviteCode, normalizeInviteCode } from '@/ui/platform';

const Brand = (props: { title: string; text?: string; top?: number }) => (
  <div className="brand" style={{ paddingTop: props.top ?? 18 }}>
    <span className="logo">O</span>
    <h2>{props.title}</h2>
    {props.text && <p>{props.text}</p>}
  </div>
);

// Cette méthode permet d'afficher la page d'invitation (Safari) : installation en 3 étapes et code à copier (§7.1).
// Elle remplace le manifeste pour que l'app installée s'ouvre sur l'inscription avec le code pré-rempli.
export function InvitePage() {
  const { code = '' } = useParams();
  const clean = normalizeInviteCode(code);
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;
    const original = link.href;
    void fetch(original)
      .then((r) => r.json())
      .then((m: Record<string, unknown>) => {
        const abs = (p: string) => new URL(p, location.origin).href;
        const icons = (m.icons as { src: string }[] | undefined)?.map((i) => ({ ...i, src: abs(i.src) }));
        const manifest = { ...m, start_url: abs(`/signup?code=${clean}`), scope: abs('/'), icons };
        link.href = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`;
      })
      .catch(() => {});
    return () => {
      link.href = original;
    };
  }, [clean]);
  return (
    <div className="page no-tab center-page">
      <Brand
        title="Bienvenue sur Overload"
        text="Ton carnet de musculation. Installe l'app sur ton iPhone en 3 étapes."
      />
      <div className="section">
        <div className="card">
          <ol className="steps">
            <li>
              <span>
                Touche le bouton Partager <b style={{ color: 'var(--accent)' }}>⬆</b> en bas de Safari.
              </span>
            </li>
            <li>Choisis « Sur l'écran d'accueil », puis « Ajouter ».</li>
            <li>Ouvre Overload depuis son icône : ton code d'invitation sera déjà rempli.</li>
          </ol>
        </div>
      </div>
      <div className="section">
        <div className="section-title">Ton code d'invitation</div>
        <div className="card" style={{ textAlign: 'center', padding: '18px 16px' }}>
          <div className="code-big">{formatInviteCode(clean)}</div>
          <button
            className="btn btn-soft btn-block"
            style={{ marginTop: 14 }}
            onClick={() =>
              void navigator.clipboard?.writeText(formatInviteCode(clean)).then(() => toast('Code copié'))
            }
          >
            Copier le code
          </button>
        </div>
        <p className="muted" style={{ fontSize: '.8125rem', marginTop: 10, lineHeight: 1.5 }}>
          Si le code n'apparaît pas dans l'app, colle-le dans le formulaire d'inscription.
        </p>
        <Link className="link-c" to={`/signup?code=${clean}`}>
          Continuer dans le navigateur
        </Link>
      </div>
    </div>
  );
}

const AGE_OPTIONS = (Object.keys(TRAINING_AGE_LABELS) as TrainingAgeBucket[]).map((b) => ({
  value: b,
  label: TRAINING_AGE_LABELS[b],
}));

// Cette méthode permet d'afficher le formulaire d'inscription, avec le code d'invitation pré-rempli ou collé (P1).
export function SignupPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(formatInviteCode(params.get('code') ?? ''));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [imperial, setImperial] = useState<'metric' | 'imperial'>('metric');
  const [age, setAge] = useState<TrainingAgeBucket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const codeOk = normalizeInviteCode(code).length === 12;

  // Cette méthode permet d'envoyer l'inscription et d'ouvrir l'onboarding en cas de succès.
  const submit = async () => {
    setError(null);
    if (!codeOk) return setError("Le code d'invitation fait 12 caractères.");
    if (!name.trim() || !email.trim()) return setError('Renseigne ton nom et ton e-mail.');
    if (password.length < 8) return setError('Mot de passe : 8 caractères minimum.');
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      units:
        imperial === 'imperial'
          ? { weight: 'lb', length: 'in', distance: 'mi' }
          : { weight: 'kg', length: 'cm', distance: 'km' },
      ...(age ? { trainingAge: { bucket: age, declaredAt: Date.now() } } : {}),
    };
    setBusy(true);
    const err = await signUpWithInvite({
      code: normalizeInviteCode(code),
      email,
      password,
      displayName: name,
      settings,
    });
    setBusy(false);
    if (err) setError(err);
    else navigate('/welcome', { replace: true });
  };

  return (
    <div className="page no-tab center-page">
      <Brand title="Créer mon compte" top={8} />
      <div className="section" style={{ marginTop: 4 }}>
        <label className="field">
          <span>Code d'invitation</span>
          <input
            value={code}
            onChange={(e) => setCode(formatInviteCode(e.target.value))}
            autoCapitalize="characters"
            autoComplete="off"
            style={{ fontFamily: 'ui-monospace,Menlo,monospace', letterSpacing: '.05em' }}
            placeholder="XXXX-XXXX-XXXX"
          />
          {codeOk && <em className="hint">✓ Format valide</em>}
        </label>
        <label className="field">
          <span>Nom affiché</span>
          <input
            placeholder="ex. Paul"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
          />
        </label>
        <label className="field">
          <span>E-mail</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="field">
          <span>Mot de passe</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <div className="field">
          <span>Unités</span>
          <Seg
            stretch
            value={imperial}
            onChange={setImperial}
            options={[
              { value: 'metric', label: 'kg · cm · km' },
              { value: 'imperial', label: 'lb · in · mi' },
            ]}
          />
        </div>
        <div className="field">
          <span>Depuis quand fais-tu de la musculation ? (facultatif)</span>
          <Chips wrap value={age} onChange={setAge} options={AGE_OPTIONS} />
          <em className="hint" style={{ color: 'var(--muted)', fontWeight: 500 }}>
            Sert à projeter ta progression. Modifiable dans les paramètres.
          </em>
        </div>
        {error && <p className="error-text">{error}</p>}
        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 20, height: 52 }}
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? 'Création…' : 'Créer mon compte'}
        </button>
        <Link className="link-c" to="/login">
          J'ai déjà un compte
        </Link>
      </div>
    </div>
  );
}

// Cette méthode permet d'afficher la connexion, avec la demande de réinitialisation du mot de passe.
export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Cette méthode permet de lancer la connexion. Pas de navigation ici : la session ouverte, le routeur quitte /login
  // de lui-même, et l'écran où l'on est (séance en cours, onglet touché pendant la synchro) est conservé.
  const submit = async () => {
    setBusy(true);
    setError(null);
    const err = await signIn(email, password);
    setBusy(false);
    if (err) setError(err);
  };

  // Cette méthode permet d'envoyer l'e-mail de réinitialisation à l'adresse saisie.
  const forgot = async () => {
    if (!email.trim()) return setError("Saisis ton e-mail d'abord.");
    const err = await requestPasswordReset(email);
    if (err) setError(err);
    else toast('E-mail envoyé. Ouvre le lien dans Safari.');
  };

  return (
    <div className="page no-tab center-page">
      <Brand title="Overload" text="Connecte-toi pour retrouver tes séances." top={40} />
      <form
        className="section"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="field">
          <span>E-mail</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
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
        {error && <p className="error-text">{error}</p>}
        <button
          type="submit"
          className="btn btn-primary btn-block"
          style={{ marginTop: 20, height: 52 }}
          disabled={busy}
        >
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
        <button type="button" className="link-c" onClick={() => void forgot()}>
          Mot de passe oublié ?
        </button>
        <Link className="link-c" style={{ color: 'var(--text-2)', fontWeight: 500 }} to="/signup">
          J'ai un code d'invitation
        </Link>
        <p
          className="muted"
          style={{ fontSize: '.8125rem', marginTop: 22, textAlign: 'center', lineHeight: 1.5 }}
        >
          Pas de compte ? L'inscription se fait uniquement avec le lien d'invitation d'un proche.
        </p>
      </form>
    </div>
  );
}

// Cette méthode permet de choisir un nouveau mot de passe depuis le lien reçu par e-mail (ouvert dans Safari, §7.2).
export function ResetPage() {
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    void supabase.auth.getSession().then(({ data: d }) => d.session && setReady(true));
    return () => data.subscription.unsubscribe();
  }, []);

  // Cette méthode permet d'enregistrer le nouveau mot de passe après vérification de la confirmation.
  const submit = async () => {
    setError(null);
    if (pwd.length < 8) return setError('8 caractères minimum.');
    if (pwd !== confirm) return setError('Les deux mots de passe diffèrent.');
    const err = await updatePassword(pwd);
    if (err) setError(err);
    else {
      setDone(true);
      await supabase.auth.signOut({ scope: 'local' });
    }
  };

  return (
    <div className="page no-tab center-page">
      <Brand title="Nouveau mot de passe" />
      {done ? (
        <div className="section">
          <div className="card" style={{ textAlign: 'center', padding: '22px 16px' }}>
            <div style={{ fontSize: '2.25rem' }}>✅</div>
            <b style={{ display: 'block', fontSize: '1.0625rem', marginTop: 6 }}>Mot de passe modifié</b>
            <p className="t2" style={{ fontSize: '.875rem', marginTop: 8, lineHeight: 1.5 }}>
              Retourne dans l'app Overload depuis ton écran d'accueil pour te connecter.
            </p>
          </div>
        </div>
      ) : (
        <div className="section">
          {!ready && <p className="muted">Vérification du lien…</p>}
          <label className="field">
            <span>Nouveau mot de passe</span>
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="field">
            <span>Confirmer</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 20, height: 52 }}
            disabled={!ready}
            onClick={() => void submit()}
          >
            Enregistrer
          </button>
        </div>
      )}
    </div>
  );
}

// Cette méthode permet d'expliquer l'installation sur l'écran d'accueil quand l'app est ouverte dans Safari sur iPhone.
export function InstallPage(props: { onContinue?: () => void }) {
  return (
    <div className="page no-tab center-page">
      <Brand title="Installe Overload" text="L'app fonctionne depuis l'écran d'accueil de ton iPhone." />
      <div className="section">
        <div className="card">
          <ol className="steps">
            <li>
              <span>
                Touche le bouton Partager <b style={{ color: 'var(--accent)' }}>⬆</b> en bas de Safari.
              </span>
            </li>
            <li>Choisis « Sur l'écran d'accueil », puis « Ajouter ».</li>
            <li>Ouvre Overload depuis son icône, puis active les notifications.</li>
          </ol>
        </div>
        {props.onContinue && (
          <button className="link-c" onClick={props.onContinue}>
            Continuer dans le navigateur
          </button>
        )}
      </div>
    </div>
  );
}
