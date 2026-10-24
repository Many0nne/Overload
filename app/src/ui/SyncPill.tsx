import { useNavigate } from 'react-router';
import { useOutboxCount } from '@/data/queries';
import { useRejectCount } from '@/data/sync/rejects';
import { syncNow } from '@/data/sync/scheduler';
import { useSyncStatus } from '@/data/sync/status';

// Cette méthode permet d'afficher l'indicateur discret de synchronisation : rien, « n en attente », « hors ligne » (§6.5)
// ou « n refusées » (modifications rejetées par le serveur, détaillées dans le journal, #58).
export function SyncPill() {
  const navigate = useNavigate();
  const pending = useOutboxCount();
  const refused = useRejectCount();
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
  if (pending === 0) return null;
  return <span className="sync-pill">● {pending} en attente</span>;
}
