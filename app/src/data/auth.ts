import type { Settings } from '@/domain/types';
import { seedCatalogIfEmpty } from './bootstrap';
import { db, getMeta, setMeta, wipeLocalData } from './db';
import { getDeviceId } from './device';
import { logError } from './errors';
import { disablePush } from './push';
import { useSession } from './session';
import { supabase, supabaseConfigured } from './supabase';
import { startSyncScheduler, syncNow } from './sync/scheduler';

// Cette méthode permet de préparer la session au démarrage : session locale d'abord (hors ligne), puis écoute des changements.
export async function initAuth(): Promise<void> {
  await getDeviceId();
  void seedCatalogIfEmpty().catch((e) => logError('catalog', e));
  if ('storage' in navigator && navigator.storage.persist) void navigator.storage.persist().catch(() => {});
  if (!supabaseConfigured) {
    useSession.getState().set({ status: 'signed_out' });
    return;
  }
  const { data } = await supabase.auth.getSession();
  await applySession(data.session?.user.id ?? null, data.session?.user.email ?? null);
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      // Déconnexion subie (jeton révoqué) : on garde la base locale et l'outbox, on demande une reconnexion (§6.6).
      if (useSession.getState().status === 'signed_in') useSession.getState().set({ needsReauth: true });
      return;
    }
    if (session) void applySession(session.user.id, session.user.email ?? null);
  });
  startSyncScheduler();
}

// Cette méthode permet d'installer l'utilisateur connecté, en vidant la base locale si un autre compte l'occupait.
async function applySession(userId: string | null, email: string | null): Promise<void> {
  if (!userId) {
    const known = await getMeta<string>('user_id');
    // Hors ligne avec une session expirée : l'app reste utilisable sur les données locales.
    if (known && (await db.profiles.get(known))) {
      useSession.getState().set({ status: 'signed_in', userId: known, email, needsReauth: true });
    } else {
      useSession.getState().set({ status: 'signed_out', userId: null, email: null });
    }
    return;
  }
  const known = await getMeta<string>('user_id');
  if (known && known !== userId) {
    await wipeLocalData();
    void seedCatalogIfEmpty().catch((e) => logError('catalog', e));
  }
  await setMeta('user_id', userId);
  useSession.getState().set({ status: 'signed_in', userId, email, needsReauth: false });
}

// Cette méthode permet de se connecter par e-mail et mot de passe, puis de lancer une première synchronisation.
export async function signIn(email: string, password: string): Promise<string | null> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error)
    return error.message.includes('Invalid login') ? 'E-mail ou mot de passe incorrect.' : error.message;
  await applySession(data.user.id, data.user.email ?? null);
  await syncNow();
  return null;
}

export type SignupInput = {
  code: string;
  email: string;
  password: string;
  displayName: string;
  settings: Settings;
};

const SIGNUP_ERRORS: Record<string, string> = {
  invalid_code: "Ce code d'invitation n'est pas valide.",
  email_taken: 'Un compte existe déjà avec cet e-mail.',
  weak_password: 'Mot de passe trop faible (8 caractères minimum).',
  invalid_input: 'Vérifie les champs du formulaire.',
  rate_limited: 'Trop de tentatives. Réessaie dans une heure.',
};

// Cette méthode permet de créer un compte avec un code d'invitation via l'Edge Function, puis d'ouvrir la session.
export async function signUpWithInvite(input: SignupInput): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('signup-with-invite', {
    body: {
      code: input.code,
      email: input.email.trim(),
      password: input.password,
      display_name: input.displayName.trim(),
      settings: input.settings,
    },
  });
  if (error) {
    let code: string | undefined;
    try {
      code = (await (error as { context?: Response }).context?.json())?.error;
    } catch {
      code = undefined;
    }
    return SIGNUP_ERRORS[code ?? ''] ?? "L'inscription a échoué. Vérifie ta connexion.";
  }
  if (!(data as { ok?: boolean })?.ok) return "L'inscription a échoué.";
  return signIn(input.email, input.password);
}

/** Éléments locaux pas encore acceptés par le serveur : lignes de l'outbox et photos non envoyées. */
export type PendingSync = { changes: number; photos: number };

// Cette méthode permet de tenter une dernière synchro avant la déconnexion, puis de compter ce qui reste à envoyer.
export async function syncBeforeSignOut(): Promise<PendingSync> {
  await syncNow();
  const [changes, photos] = await Promise.all([
    db.outbox.count(),
    db.blobs.filter((b) => !b.uploaded).count(),
  ]);
  return { changes, photos };
}

// Cette méthode permet de se déconnecter volontairement : la base locale est vidée, y compris ce qui n'est pas synchronisé.
// Hors ligne, la révocation serveur échoue : on ferme alors la session locale pour ne pas la retrouver au rechargement.
// L'abonnement push est retiré avant, tant que la session autorise l'appel, pour ne pas notifier le compte suivant.
export async function signOut(): Promise<void> {
  await disablePush();
  const { error } = await supabase.auth.signOut();
  if (error) await supabase.auth.signOut({ scope: 'local' });
  await wipeLocalData();
  useSession.getState().set({ status: 'signed_out', userId: null, email: null, needsReauth: false });
}

// Cette méthode permet de demander l'e-mail de réinitialisation, dont le lien s'ouvre sur /reset dans le navigateur (§7.2).
export async function requestPasswordReset(email: string): Promise<string | null> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${location.origin}/reset`,
  });
  return error ? error.message : null;
}

// Cette méthode permet d'enregistrer le nouveau mot de passe depuis la page /reset.
export async function updatePassword(password: string): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({ password });
  return error ? error.message : null;
}
