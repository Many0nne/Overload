import { useEffect, useState } from 'react';
import { type LoggedError, readErrors } from '@/data/errors';
import { clearRejects, readRejects, type SyncReject } from '@/data/sync/rejects';
import { SubHead, toast } from '@/ui/components';

const TABLE_LABELS: Record<SyncReject['table'], string> = {
  profiles: 'Profil',
  exercises: 'Exercice',
  folders: 'Dossier',
  routines: 'Routine',
  workouts: 'Séance',
  body_measurements: 'Mesure',
  exercise_prefs: "Réglages d'exercice",
};

// Cette méthode permet de consulter et copier le journal d'erreurs local (§16),
// et de prendre connaissance des modifications refusées par le serveur (#58).
export default function ErrorLogPage() {
  const [errors, setErrors] = useState<LoggedError[]>([]);
  const [rejects, setRejects] = useState<SyncReject[]>([]);
  useEffect(() => {
    void readErrors().then((e) => setErrors([...e].reverse()));
    void readRejects().then((r) => setRejects([...r].reverse()));
  }, []);
  const text = errors.map((e) => `${new Date(e.at).toISOString()} [${e.scope}] ${e.message}`).join('\n');
  return (
    <>
      <SubHead
        title="Journal d'erreurs"
        right={
          errors.length > 0 && (
            <button
              className="btn-ghost"
              onClick={() => void navigator.clipboard?.writeText(text).then(() => toast('Journal copié'))}
            >
              Copier
            </button>
          )
        }
      />
      {rejects.length > 0 && (
        <div className="section" data-testid="sync-rejects">
          <div className="section-title">Modifications refusées</div>
          <p className="t2" style={{ fontSize: '.8125rem' }}>
            Le serveur a refusé ces modifications : l'appareil a repris la version enregistrée sur le serveur
            (ou retiré l'élément s'il n'y existe pas).
          </p>
          <div className="card" style={{ fontSize: '.8125rem', wordBreak: 'break-word' }}>
            {rejects.map((r) => (
              <div key={`${r.at}-${r.table}-${r.id}`}>
                {new Date(r.at).toLocaleString('fr-FR')} · {TABLE_LABELS[r.table] ?? r.table} ·{' '}
                {r.status === 'forbidden' ? 'non autorisée' : 'invalide'}
                <span className="t2"> ({r.id})</span>
              </div>
            ))}
          </div>
          <button
            className="btn-ghost"
            onClick={async () => {
              await clearRejects();
              setRejects([]);
            }}
          >
            Effacer
          </button>
        </div>
      )}
      {errors.length === 0 ? (
        <p className="empty">Aucune erreur enregistrée.</p>
      ) : (
        <div className="section">
          <div
            className="card"
            style={{ fontSize: '.8125rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          >
            {text}
          </div>
        </div>
      )}
    </>
  );
}
