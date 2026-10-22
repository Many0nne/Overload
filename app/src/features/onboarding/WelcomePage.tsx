import { useState } from 'react';
import { useNavigate } from 'react-router';
import { enablePush, pushSupported } from '@/data/push';
import { startEmptyWorkout } from '@/features/workout-live/start';
import { toast } from '@/ui/components';

// Cette méthode permet d'accueillir un nouvel inscrit : activer les notifications, puis créer une routine ou démarrer (P1.4).
export default function WelcomePage() {
  const navigate = useNavigate();
  const [asked, setAsked] = useState(false);

  // Cette méthode permet de demander l'autorisation de notification depuis le geste de l'utilisateur (exigence iOS).
  const askPush = async () => {
    const r = await enablePush();
    setAsked(true);
    toast(r === 'granted' ? 'Notifications activées' : r === 'denied' ? 'Notifications refusées' : 'Indisponible ici');
  };

  return (
    <div className="page no-tab center-page">
      <div className="brand" style={{ paddingTop: 40 }}>
        <span className="logo">O</span>
        <h2>C'est parti !</h2>
        <p>Deux réglages rapides et tu peux t'entraîner.</p>
      </div>
      <div className="section">
        <div className="card">
          <b>Fin du temps de repos</b>
          <p className="t2" style={{ fontSize: '.875rem', marginTop: 6, lineHeight: 1.5 }}>
            Une notification te prévient quand le repos est fini, même écran verrouillé.
          </p>
          <button
            className="btn btn-soft btn-block"
            style={{ marginTop: 12 }}
            disabled={asked || !pushSupported()}
            onClick={() => void askPush()}
          >
            {pushSupported() ? (asked ? 'Choix enregistré' : 'Activer les notifications') : 'Disponible dans l’app installée'}
          </button>
        </div>
      </div>
      <div className="section">
        <button className="btn btn-primary btn-block" style={{ height: 52 }} onClick={() => navigate('/seance/routine/new', { replace: true })}>
          Créer ma première routine
        </button>
        <button
          className="btn btn-soft btn-block"
          style={{ marginTop: 8 }}
          onClick={async () => navigate(`/workout/${await startEmptyWorkout()}`, { replace: true })}
        >
          Démarrer une séance vide
        </button>
        <button className="link-c" onClick={() => navigate('/', { replace: true })}>
          Plus tard
        </button>
      </div>
    </div>
  );
}
