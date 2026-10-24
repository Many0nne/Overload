import { useState } from 'react';
import { useNavigate } from 'react-router';
import { parseDuration } from '@/domain/format';
import { SubHead, toast } from '@/ui/components';
import { createPastWorkout } from './start';

// Cette méthode permet de saisir une séance passée : date, heure de début et durée, puis l'éditeur sans minuteur (§F7.4).
// Elle reste possible même si une séance est en cours.
export default function PastWorkoutPage() {
  const navigate = useNavigate();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const [date, setDate] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState('1:00:00');

  // Cette méthode permet de créer la séance passée puis d'ouvrir l'éditeur pour y ajouter les exercices.
  const create = async () => {
    const durationS = parseDuration(duration);
    if (!durationS) return toast('Durée invalide (h:mm:ss)');
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    const startedAt = new Date(y!, (m ?? 1) - 1, d, hh, mm).getTime();
    if (Number.isNaN(startedAt) || startedAt > Date.now()) return toast('Date invalide');
    const id = await createPastWorkout(startedAt, durationS);
    navigate(`/workout/${id}`, { replace: true });
  };

  return (
    <>
      <SubHead title="Séance passée" />
      <div className="section mt-0">
        <p className="t2 fs-14 lh-15">
          Enregistre une séance faite sans l'app. Ajoute ensuite les exercices et coche les séries réalisées.
        </p>
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="field-row cols-2">
          <label className="field">
            <span>Début</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label className="field">
            <span>Durée</span>
            <input value={duration} inputMode="numeric" onChange={(e) => setDuration(e.target.value)} />
          </label>
        </div>
        <button className="btn btn-primary btn-block mt-20 btn-lg" onClick={() => void create()}>
          Continuer
        </button>
      </div>
    </>
  );
}
