import { useNavigate } from 'react-router';
import { useAbandonedPhotoCount } from '@/data/photos';
import { useOutboxCount } from '@/data/queries';
import { useRejectCount } from '@/data/sync/rejects';
import { syncNow } from '@/data/sync/scheduler';
import { useSyncStatus } from '@/data/sync/status';

// Cette méthode permet d'afficher l'indicateur discret de synchronisation : rien, « n en attente », « hors ligne » (§6.5)
// « n refusées » (modifications rejetées par le serveur, #58) ou « n photos non envoyées » (#59), détaillées dans le journal.
export function SyncPill() {
  const navigate = useNavigate();
  const pending = useOutboxCount();
  const refused = useRejectCount();
  const photos = useAbandonedPhotoCount();
  const { online, lastCallFailed } = useSyncStatus();
  if (!online || lastCallFailed) {
    return (
      <button className="sync-pill off" onClick={() => void syncNow()} title="Réessayer la synchronisation">
        ● hors ligne{pending > 0 ? ` · ${pending}` : ''}
      </button>
    );
  }
  if (refused > 0) {
    return (
      <button
        className="sync-pill off"
        onClick={() => navigate('/profile/settings/errors')}
        title="Voir les modifications refusées par le serveur"
      >
        ⚠ {refused} refusée{refused > 1 ? 's' : ''}
      </button>
    );
  }
  if (photos > 0) {
    return (
      <button
        className="sync-pill off"
        onClick={() => navigate('/profile/settings/errors')}
        title="Voir les photos que le serveur a refusées"
      >
        ⚠ {photos} photo{photos > 1 ? 's' : ''} non envoyée{photos > 1 ? 's' : ''}
      </button>
    );
  }
  if (pending === 0) return null;
  return <span className="sync-pill">● {pending} en attente</span>;
}
