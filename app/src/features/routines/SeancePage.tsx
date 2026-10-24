import { lazy, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import { useExerciseMap, useFolders, useRoutines } from '@/data/queries';
import {
  createFolder,
  deleteFolder,
  deleteRoutine,
  duplicateRoutine,
  updateFolder,
  updateRoutine,
} from '@/data/repositories';
import type { FolderRow, RoutineRow } from '@/domain/types';
import { unlockAudio } from '@/features/workout-live/restTimer';
import { startEmptyWorkout, startFromRoutine, WorkoutAlreadyRunning } from '@/features/workout-live/start';
import { Sheet, toast } from '@/ui/components';
import { PlusIcon } from '@/ui/icons';

const LibraryPage = lazy(() => import('@/features/library/LibraryPage'));
const RoutineEditor = lazy(() => import('./RoutineEditor'));
const PastWorkoutPage = lazy(() => import('@/features/workout-live/PastWorkoutPage'));

// Cette méthode permet de router les écrans de l'onglet Séance (accueil, bibliothèque, routine, séance passée).
export default function SeancePage() {
  return (
    <Routes>
      <Route index element={<SeanceHome />} />
      <Route path="library/*" element={<LibraryPage />} />
      <Route path="routine/:id" element={<RoutineEditor />} />
      <Route path="past" element={<PastWorkoutPage />} />
    </Routes>
  );
}

// Cette méthode permet de démarrer une séance en gérant le cas d'une séance déjà en cours sur le compte (§F7.9).
export function useStartWorkout() {
  const navigate = useNavigate();
  return async (routineId?: string) => {
    unlockAudio(); // dans le geste, avant tout await : iOS n'accepterait plus le son ensuite
    try {
      const id = routineId ? await startFromRoutine(routineId) : await startEmptyWorkout();
      navigate(`/workout/${id}`);
    } catch (e) {
      if (e instanceof WorkoutAlreadyRunning) {
        toast('Une séance est déjà en cours');
        navigate(`/workout/${e.workoutId}`);
      } else toast(e instanceof Error ? e.message : 'Démarrage impossible');
    }
  };
}

// Cette méthode permet d'estimer la durée d'une routine (≈ 45 s d'effort + repos par série) pour l'étiquette « ~ 1 h ».
function estimateMinutes(r: RoutineRow): number {
  let s = 0;
  for (const e of r.doc.exercises) s += e.sets.length * (45 + (e.restS ?? 60));
  return Math.max(5, Math.round(s / 300) * 5);
}

// Cette méthode permet d'afficher une durée estimée arrondie (« ~ 1 h 15 », « ~ 45 min »).
function formatEstimate(min: number): string {
  if (min < 60) return `~ ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `~ ${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}`;
}

// Cette méthode permet d'afficher l'onglet Séance : séance vide, bibliothèque, séance passée, routines rangées en dossiers.
function SeanceHome() {
  const navigate = useNavigate();
  const start = useStartWorkout();
  const folders = useFolders();
  const routines = useRoutines();
  const exercises = useExerciseMap();
  const [folderSheet, setFolderSheet] = useState<FolderRow | 'new' | null>(null);
  const [routineSheet, setRoutineSheet] = useState<RoutineRow | null>(null);
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState<{ title: string; run: () => Promise<void> } | null>(null);

  const groups: { folder: FolderRow | null; list: RoutineRow[] }[] = [
    ...(folders ?? []).map((f) => ({
      folder: f,
      list: (routines ?? []).filter((r) => r.folder_id === f.id),
    })),
  ];
  const known = new Set((folders ?? []).map((f) => f.id));
  const loose = (routines ?? []).filter((r) => !r.folder_id || !known.has(r.folder_id));
  if (loose.length > 0 || groups.length === 0) groups.push({ folder: null, list: loose });

  // Cette méthode permet de déplacer un dossier d'un cran en échangeant les positions.
  const moveFolder = async (f: FolderRow, delta: -1 | 1) => {
    const list = folders ?? [];
    const i = list.findIndex((x) => x.id === f.id);
    const other = list[i + delta];
    if (!other) return;
    await updateFolder(f.id, { position: other.position });
    await updateFolder(other.id, { position: f.position });
  };

  return (
    <>
      <div className="head">
        <h2>Séance</h2>
      </div>
      <div className="section mt-4">
        <button className="btn btn-primary btn-block btn-lg" onClick={() => void start()}>
          <PlusIcon />
          Démarrer une séance vide
        </button>
        <div className="flex gap-8 mt-8">
          <button className="btn btn-soft flex-1" onClick={() => navigate('/seance/library')}>
            Bibliothèque
          </button>
          <button className="btn btn-soft flex-1" onClick={() => navigate('/seance/past')}>
            Séance passée
          </button>
        </div>
      </div>
      <div className="section">
        <div className="section-title">
          Routines
          <span className="flex gap-4">
            <button
              className="btn-ghost fs-14 normal-case"
              onClick={() => {
                setName('');
                setFolderSheet('new');
              }}
            >
              + Dossier
            </button>
            <button className="btn-ghost fs-14 normal-case" onClick={() => navigate('/seance/routine/new')}>
              + Nouvelle
            </button>
          </span>
        </div>
        {routines && routines.length === 0 && (
          <p className="empty compact">
            Pas encore de routine. Crée ton premier programme ou démarre une séance vide.
          </p>
        )}
        {groups.map(({ folder, list }) => {
          const closed = folder?.collapsed ?? false;
          return (
            <div key={folder?.id ?? 'none'} className={`folder mt-12${closed ? ' closed' : ''}`}>
              {(folder || groups.length > 1) && (
                <div className="flex items-center">
                  <button
                    className="folder-h"
                    onClick={() => folder && void updateFolder(folder.id, { collapsed: !folder.collapsed })}
                  >
                    <span className="chev">▾</span> {folder?.name ?? 'Mes routines'}{' '}
                    <span className="count">{list.length}</span>
                  </button>
                  {folder && (
                    <button
                      className="icon-btn"
                      aria-label="Actions du dossier"
                      onClick={() => {
                        setName(folder.name);
                        setFolderSheet(folder);
                      }}
                    >
                      ⋯
                    </button>
                  )}
                </div>
              )}
              <div className="folder-body">
                {list.map((r) => (
                  <div key={r.id} className="card routine">
                    <h4>
                      {r.doc.name}
                      <span className="flex gap-6 items-center">
                        <span className="tag">{formatEstimate(estimateMinutes(r))}</span>
                        <button className="tag acc" onClick={() => setRoutineSheet(r)}>
                          ⋯
                        </button>
                      </span>
                    </h4>
                    <p>
                      {r.doc.exercises.map((e) => exercises.get(e.exerciseId)?.name ?? '?').join(', ') ||
                        'Aucun exercice'}
                    </p>
                    <button className="btn btn-primary btn-block btn-sm" onClick={() => void start(r.id)}>
                      Démarrer
                    </button>
                  </div>
                ))}
                {folder && list.length === 0 && <p className="muted fs-13 pb-8">Dossier vide.</p>}
              </div>
            </div>
          );
        })}
      </div>

      <Sheet
        open={folderSheet !== null}
        title={folderSheet === 'new' ? 'Nouveau dossier' : 'Dossier'}
        onClose={() => setFolderSheet(null)}
        actions={[
          {
            label: folderSheet === 'new' ? 'Créer' : 'Renommer',
            kind: 'primary',
            onClick: async () => {
              if (!name.trim()) return;
              if (folderSheet === 'new') await createFolder(name.trim());
              else if (folderSheet) await updateFolder(folderSheet.id, { name: name.trim() });
              setFolderSheet(null);
            },
          },
          ...(folderSheet && folderSheet !== 'new'
            ? [
                {
                  label: 'Monter',
                  onClick: async () => {
                    await moveFolder(folderSheet, -1);
                    setFolderSheet(null);
                  },
                },
                {
                  label: 'Descendre',
                  onClick: async () => {
                    await moveFolder(folderSheet, 1);
                    setFolderSheet(null);
                  },
                },
                {
                  label: 'Supprimer le dossier',
                  kind: 'danger' as const,
                  onClick: async () => {
                    await deleteFolder(folderSheet.id);
                    setFolderSheet(null);
                  },
                },
              ]
            : []),
        ]}
      >
        <label className="field">
          <span>Nom du dossier</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. PPL" />
        </label>
        {folderSheet !== 'new' && (
          <p className="fine mt-8">Supprimer le dossier garde ses routines dans « Mes routines ».</p>
        )}
      </Sheet>

      <Sheet
        open={routineSheet !== null}
        title={routineSheet?.doc.name}
        onClose={() => setRoutineSheet(null)}
        actions={
          routineSheet
            ? [
                {
                  label: 'Modifier',
                  kind: 'primary',
                  onClick: () => navigate(`/seance/routine/${routineSheet.id}`),
                },
                {
                  label: 'Dupliquer',
                  onClick: async () => {
                    await duplicateRoutine(routineSheet.id);
                    setRoutineSheet(null);
                    toast('Routine dupliquée');
                  },
                },
                ...(folders ?? [])
                  .filter((f) => f.id !== routineSheet.folder_id)
                  .map((f) => ({
                    label: `Déplacer dans « ${f.name} »`,
                    onClick: async () => {
                      await updateRoutine(routineSheet.id, { folder_id: f.id });
                      setRoutineSheet(null);
                    },
                  })),
                ...(routineSheet.folder_id
                  ? [
                      {
                        label: 'Sortir du dossier',
                        onClick: async () => {
                          await updateRoutine(routineSheet.id, { folder_id: null });
                          setRoutineSheet(null);
                        },
                      },
                    ]
                  : []),
                {
                  label: 'Supprimer',
                  kind: 'danger' as const,
                  onClick: () => {
                    const r = routineSheet;
                    setRoutineSheet(null);
                    setConfirm({ title: `Supprimer « ${r.doc.name} » ?`, run: () => deleteRoutine(r.id) });
                  },
                },
              ]
            : []
        }
      />
      <Sheet
        open={confirm !== null}
        title={confirm?.title}
        onClose={() => setConfirm(null)}
        actions={[
          {
            label: 'Supprimer',
            kind: 'danger',
            onClick: async () => {
              await confirm?.run();
              setConfirm(null);
            },
          },
          { label: 'Annuler', onClick: () => setConfirm(null) },
        ]}
      />
    </>
  );
}
