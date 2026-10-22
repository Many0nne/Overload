import { create } from 'zustand';

export type SessionStatus = 'loading' | 'signed_out' | 'signed_in';

type SessionState = {
  status: SessionStatus;
  userId: string | null;
  email: string | null;
  needsReauth: boolean; // jeton révoqué : reconnexion demandée sans purger la base locale (§6.6)
  set: (patch: Partial<Omit<SessionState, 'set'>>) => void;
};

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  userId: null,
  email: null,
  needsReauth: false,
  set: (patch) => set(patch),
}));

// Cette méthode permet d'obtenir l'utilisateur connecté lorsqu'un repository doit renseigner user_id.
export function currentUserId(): string {
  const id = useSession.getState().userId;
  if (!id) throw new Error('Aucun utilisateur connecté');
  return id;
}
