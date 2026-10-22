import { useState } from 'react';
import { wipeLocalData } from '@/data/db';
import { useSession } from '@/data/session';
import { supabase } from '@/data/supabase';
import { Sheet, toast } from '@/ui/components';

// Cette méthode permet de supprimer définitivement le compte après saisie de « SUPPRIMER » (§14).
// Le serveur efface photos et données, puis l'appareil vide IndexedDB, les caches et l'abonnement push.
export function DeleteAccountSheet(props: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  // Cette méthode permet d'appeler l'Edge Function delete-account puis de nettoyer l'appareil.
  const confirm = async () => {
    if (text.trim() !== 'SUPPRIMER') return toast('Saisis SUPPRIMER pour confirmer');
    setBusy(true);
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) {
      setBusy(false);
      return toast('Suppression impossible (réseau ?)');
    }
    try {
      const reg = await navigator.serviceWorker?.ready;
      await (await reg?.pushManager.getSubscription())?.unsubscribe();
      for (const k of await caches.keys()) if (!k.startsWith('workbox-precache')) await caches.delete(k);
    } catch {
      // nettoyage best effort
    }
    await supabase.auth.signOut({ scope: 'local' });
    await wipeLocalData();
    localStorage.clear();
    useSession.getState().set({ status: 'signed_out', userId: null, email: null, needsReauth: false });
  };

  return (
    <Sheet
      open={props.open}
      title="Supprimer le compte"
      onClose={props.onClose}
      actions={[
        { label: busy ? 'Suppression…' : 'Supprimer définitivement', kind: 'danger', onClick: confirm },
        { label: 'Annuler', onClick: props.onClose },
      ]}
    >
      <p>Toutes tes séances, routines, mesures et photos seront supprimées. Cette action est irréversible.</p>
      <label className="field">
        <span>Saisis SUPPRIMER pour confirmer</span>
        <input value={text} onChange={(e) => setText(e.target.value)} autoCapitalize="characters" />
      </label>
    </Sheet>
  );
}
