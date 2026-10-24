import { Route, Routes, useNavigate } from 'react-router';
import { createExercise } from '@/data/repositories';
import { SubHead, toast } from '@/ui/components';
import { ExerciseForm } from './ExerciseForm';
import { ExerciseList } from './ExerciseList';

// Cette méthode permet de router la bibliothèque : liste des exercices et création d'un exercice personnalisé.
export default function LibraryPage() {
  return (
    <Routes>
      <Route index element={<LibraryHome />} />
      <Route path="new" element={<NewExercise />} />
    </Routes>
  );
}

// Cette méthode permet d'afficher la bibliothèque d'exercices ; toucher un exercice ouvre sa fiche.
function LibraryHome() {
  const navigate = useNavigate();
  return (
    <>
      <SubHead
        title="Exercices"
        right={
          <button className="btn-ghost fw-650" onClick={() => navigate('/seance/library/new')}>
            Créer
          </button>
        }
      />
      <ExerciseList onPick={(e) => navigate(`/exercise/${e.id}`)} />
    </>
  );
}

// Cette méthode permet de créer un exercice personnalisé, propre à l'utilisateur (§F7.2).
function NewExercise() {
  const navigate = useNavigate();
  return (
    <>
      <SubHead title="Nouvel exercice" />
      <ExerciseForm
        typeLocked={false}
        submitLabel="Créer l'exercice"
        onSubmit={async (input) => {
          const row = await createExercise(input);
          toast('Exercice créé');
          navigate(`/exercise/${row.id}`, { replace: true });
        }}
      />
    </>
  );
}
