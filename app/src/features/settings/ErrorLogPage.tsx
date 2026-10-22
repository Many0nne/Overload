import { useEffect, useState } from 'react';
import { type LoggedError, readErrors } from '@/data/errors';
import { SubHead, toast } from '@/ui/components';

// Cette méthode permet de consulter et copier le journal d'erreurs local (§16).
export default function ErrorLogPage() {
  const [errors, setErrors] = useState<LoggedError[]>([]);
  useEffect(() => {
    void readErrors().then((e) => setErrors([...e].reverse()));
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
      {errors.length === 0 ? (
        <p className="empty">Aucune erreur enregistrée.</p>
      ) : (
        <div className="section">
          <div className="card" style={{ fontSize: '.8125rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {text}
          </div>
        </div>
      )}
    </>
  );
}
