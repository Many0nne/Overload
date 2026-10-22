import { useOutboxCount } from '@/data/queries';
import { syncNow } from '@/data/sync/scheduler';
import { useSyncStatus } from '@/data/sync/status';

// Cette méthode permet d'afficher l'indicateur discret de synchronisation : rien, « n en attente » ou « hors ligne » (§6.5).
export function SyncPill() {
  const pending = useOutboxCount();
  const { online, lastCallFailed } = useSyncStatus();
  if (!online || lastCallFailed) {
    return (
      <button className="sync-pill off" onClick={() => void syncNow()} title="Réessayer la synchronisation">
        ● hors ligne{pending > 0 ? ` · ${pending}` : ''}
      </button>
    );
  }
  if (pending === 0) return null;
  return <span className="sync-pill">● {pending} en attente</span>;
}
