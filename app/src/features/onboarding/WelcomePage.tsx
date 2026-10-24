import { useState } from 'react';
import { useNavigate } from 'react-router';
import { enablePush, pushSupported } from '@/data/push';
import { unlockAudio } from '@/features/workout-live/restTimer';
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
    toast(
      r === 'granted'
        ? 'Notifications activées'
        : r === 'denied'
          ? 'Notifications refusées'
          : 'Indisponible ici',
    );
  };

  return (
    <div className="page no-tab center-page">
      <div className="brand loose">
        <span className="logo">O</span>
        <h2>C'est parti !</h2>
        <p>Deux réglages rapides et tu peux t'entraîner.</p>
      </div>
      <div className="section">
        <div className="card">
          <b>Fin du temps de repos</b>
          <p className="t2 fs-14 mt-6 lh-15">
            Une notification te prévient quand le repos est fini, même écran verrouillé.
          </p>
          <button
            className="btn btn-soft btn-block mt-12"
            disabled={asked || !pushSupported()}
            onClick={() => void askPush()}
          >
            {pushSupported()
              ? asked
                ? 'Choix enregistré'
                : 'Activer les notifications'
              : 'Disponible dans l’app installée'}
          </button>
        </div>
      </div>
      <div className="section">
        <button
          className="btn btn-primary btn-block btn-lg"
          onClick={() => navigate('/seance/routine/new', { replace: true })}
        >
          Créer ma première routine
        </button>
        <button
          className="btn btn-soft btn-block mt-8"
          onClick={async () => {
            unlockAudio();
            navigate(`/workout/${await startEmptyWorkout()}`, { replace: true });
          }}
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
