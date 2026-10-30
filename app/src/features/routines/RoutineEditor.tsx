import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { db } from '@/data/db';
import { useExerciseMap, useFolders, useSettings } from '@/data/queries';
import { createRoutine, deleteRoutine, updateRoutine } from '@/data/repositories';
import { uuidv7 } from '@/domain/ids';
import { SET_KIND_LABELS, setLabels } from '@/domain/labels';
import { fieldsFor, hasReps, type SetField, weightUnitLabel } from '@/domain/measurement';
import { parseRepRange } from '@/domain/progression';
import type { ExerciseRow, RoutineDoc, RoutineExercise, RoutineSet, SetKind, Settings } from '@/domain/types';
import { ExerciseList } from '@/features/library/ExerciseList';
import { fieldText, parseField } from '@/features/workout-live/SetRow';
import { Seg, Sheet, toast } from '@/ui/components';
import { DotsIcon } from '@/ui/icons';
import { KIND_CLASS } from '@/ui/setKind';
import { formatRest } from '@/ui/time';

const REST_CHOICES: (number | null)[] = [null, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
const ROUTINE_FIELDS = (type: ExerciseRow['measurement_type']): SetField[] =>
  fieldsFor(type).filter((f) => f !== 'reps');

// Cette méthode permet d'afficher la cible d'une série de routine (« 80 kg », « +17,5 », « 1:10 »).
function setChipText(s: RoutineSet, ex: ExerciseRow | undefined, units: Settings['units']): string {
  if (!ex) return '';
  const parts = ROUTINE_FIELDS(ex.measurement_type)
    .map((f) => fieldText(s, f, units))
    .filter(Boolean);
  if (parts.length === 0) return '';
  const prefix =
    ex.measurement_type === 'weighted_bw' ? '+' : ex.measurement_type === 'assisted_bw' ? '−' : '';
  const unit =
    ex.measurement_type === 'weight_reps' || ex.measurement_type === 'weight_duration'
      ? ` ${units.weight}`
      : '';
  return `${prefix}${parts[0]}${parts.length === 1 ? unit : ` · ${parts.slice(1).join(' · ')}`}`;
}

// Cette méthode permet d'afficher la fourchette de reps sous forme éditable (« 8–12 », « 8 »).
function rangeText(r: RoutineExercise['repRange']): string {
  if (!r) return '';
  return r.min === r.max ? String(r.min) : `${r.min}–${r.max}`;
}

// Cette méthode permet d'afficher une carte d'exercice de routine, déplaçable par sa poignée (glisser-déposer).
function SortableExercise(props: {
  entry: RoutineExercise;
  exercise: ExerciseRow | undefined;
  units: Settings['units'];
  onChange: (e: RoutineExercise) => void;
  onMenu: () => void;
  onEditSet: (setId: string) => void;
  onRest: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.entry.id,
  });
  const { entry, exercise } = props;
  const [range, setRange] = useState(rangeText(entry.repRange));
  const labels = setLabels(entry.sets.map((s) => s.kind));
  const type = exercise?.measurement_type ?? 'weight_reps';
  return (
    <div
      ref={setNodeRef}
      className={`card re-ex${isDragging ? ' dragging' : ''}`}
      // Position et animation calculées par dnd-kit à chaque déplacement : seules valeurs laissées inline.
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="top">
        {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: rôle et focus fournis par les attributs dnd-kit */}
        <span className="grip" {...attributes} {...listeners} aria-label="Réordonner">
          ⠿
        </span>
        <b>{exercise?.name ?? 'Exercice supprimé'}</b>
        <button className="icon-btn" aria-label="Actions" onClick={props.onMenu}>
          <DotsIcon />
        </button>
      </div>
      {hasReps(type) && (
        <div className="re-row">
          <div>
            Fourchette de reps<small>Séries de travail · « 8 » = nombre fixe</small>
          </div>
          <input
            className="re-in"
            value={range}
            inputMode="text"
            placeholder="8–12"
            onChange={(e) => setRange(e.target.value)}
            onBlur={() => {
              if (!range.trim()) return props.onChange({ ...entry, repRange: undefined });
              const r = parseRepRange(range);
              if (!r) {
                toast('Fourchette invalide (ex. 8–12)');
                return setRange(rangeText(entry.repRange));
              }
              setRange(rangeText(r));
              props.onChange({ ...entry, repRange: r });
            }}
          />
        </div>
      )}
      <div className="re-row stacked">
        <div>
          Séries
          <small>
            {ROUTINE_FIELDS(type).length ? 'cible (touche pour modifier)' : 'touche pour modifier'}
          </small>
        </div>
        <div className="re-sets">
          {entry.sets.map((s, i) => (
            <button key={s.id} onClick={() => props.onEditSet(s.id)} className="bare">
              <span>
                <em className={KIND_CLASS[s.kind] || undefined}>{labels[i]}</em>
                {setChipText(s, exercise, props.units)}
              </span>
            </button>
          ))}
          <button
            className="bare"
            onClick={() => {
              const last = entry.sets.at(-1);
              const { id: _id, ...rest } = last ?? { id: '', kind: 'normal' as SetKind };
              props.onChange({
                ...entry,
                sets: [
                  ...entry.sets,
                  { ...rest, id: uuidv7(), kind: last?.kind === 'warmup' ? 'normal' : rest.kind },
                ],
              });
            }}
          >
            <span className="c-accent">+</span>
          </button>
        </div>
      </div>
      <button className="re-row w-full" onClick={props.onRest}>
        Repos<span className="c-accent fw-600">{formatRest(entry.restS)} ›</span>
      </button>
    </div>
  );
}

// Cette méthode permet de créer ou modifier une routine : nom, dossier, exercices ordonnés, fourchettes, séries cibles, repos (§F7.3).
export default function RoutineEditor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const settings = useSettings();
  const folders = useFolders();
  const exercises = useExerciseMap();
  const [doc, setDoc] = useState<RoutineDoc | null>(
    isNew ? { schemaVersion: 1, name: '', exercises: [] } : null,
  );
  const [folderId, setFolderId] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ replace?: string } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [restFor, setRestFor] = useState<string | null>(null);
  const [setEdit, setSetEdit] = useState<{ entryId: string; setId: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
  );

  useEffect(() => {
    if (isNew || !id) return;
    void db.routines.get(id).then((r) => {
      if (!r) return navigate('/seance', { replace: true });
      setDoc(structuredClone(r.doc));
      setFolderId(r.folder_id);
    });
  }, [id, isNew, navigate]);

  if (!doc) return <div className="page" />;

  // Cette méthode permet de modifier un exercice de la routine.
  const patchEntry = (e: RoutineExercise) =>
    setDoc((d) => d && { ...d, exercises: d.exercises.map((x) => (x.id === e.id ? e : x)) });

  // Cette méthode permet d'ajouter un exercice choisi dans la bibliothèque (3 séries normales, repos par défaut).
  const pick = (ex: ExerciseRow) => {
    const replace = picker?.replace;
    setPicker(null);
    const entry: RoutineExercise = {
      id: uuidv7(),
      exerciseId: ex.id,
      restS: settings.defaultRestS,
      ...(hasReps(ex.measurement_type) && ex.measurement_type !== 'bodyweight'
        ? { repRange: { min: 8, max: 12 } }
        : {}),
      sets: Array.from({ length: 3 }, () => ({ id: uuidv7(), kind: 'normal' as SetKind })),
    };
    setDoc((d) => {
      if (!d) return d;
      if (!replace) return { ...d, exercises: [...d.exercises, entry] };
      return {
        ...d,
        exercises: d.exercises.map((x) =>
          x.id === replace
            ? { ...entry, restS: x.restS, sets: x.sets.map((s) => ({ id: s.id, kind: s.kind })) }
            : x,
        ),
      };
    });
  };

  // Cette méthode permet d'enregistrer la routine puis de revenir à l'onglet Séance.
  const save = async () => {
    if (!doc.name.trim()) return toast('Donne un nom à la routine');
    const clean = { ...doc, name: doc.name.trim() };
    if (isNew) await createRoutine(clean, folderId);
    else await updateRoutine(id!, { doc: clean, folder_id: folderId });
    navigate('/seance', { replace: true });
  };

  const onDragEnd = (ev: DragEndEvent) => {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    setDoc((d) => {
      if (!d) return d;
      const from = d.exercises.findIndex((e) => e.id === active.id);
      const to = d.exercises.findIndex((e) => e.id === over.id);
      return { ...d, exercises: arrayMove(d.exercises, from, to) };
    });
  };

  const editing = setEdit && doc.exercises.find((e) => e.id === setEdit.entryId);
  const editingSet = editing?.sets.find((s) => s.id === setEdit?.setId);
  const editingEx = editing ? exercises.get(editing.exerciseId) : undefined;

  return (
    <>
      <div className="head">
        <button className="btn-ghost fw-600" onClick={() => navigate(-1)}>
          Annuler
        </button>
        <span className="title-sm">{isNew ? 'Nouvelle routine' : 'Modifier la routine'}</span>
        <button className="btn-ghost fw-700" onClick={() => void save()}>
          Enregistrer
        </button>
      </div>
      <div className="section mt-0">
        <label className="field mt-0">
          <span>Nom</span>
          <input
            value={doc.name}
            onChange={(e) => setDoc({ ...doc, name: e.target.value })}
            placeholder="ex. Push"
          />
        </label>
        <label className="field">
          <span>Dossier</span>
          <select
            value={folderId ?? ''}
            onChange={(e) => setFolderId(e.target.value || null)}
            className="select"
          >
            <option value="">Mes routines (sans dossier)</option>
            {(folders ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="section">
        <div className="section-title">
          Exercices <span className="muted normal-case fw-500">glisser ⠿ pour réordonner</span>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={doc.exercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            {doc.exercises.map((e) => (
              <SortableExercise
                key={e.id}
                entry={e}
                exercise={exercises.get(e.exerciseId)}
                units={settings.units}
                onChange={patchEntry}
                onMenu={() => setMenu(e.id)}
                onEditSet={(setId) => setSetEdit({ entryId: e.id, setId })}
                onRest={() => setRestFor(e.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
        <button className="btn btn-soft btn-block mt-12 c-accent" onClick={() => setPicker({})}>
          + Ajouter un exercice
        </button>
        {!isNew && (
          <button className="btn btn-danger btn-block mt-6" onClick={() => setConfirmDelete(true)}>
            Supprimer la routine
          </button>
        )}
      </div>

      {picker && (
        <div className="scrim show full">
          <div className="sheet full">
            <div className="head sheet-head">
              <button className="btn-ghost" onClick={() => setPicker(null)}>
                Annuler
              </button>
              <span className="title-sm">{picker.replace ? 'Remplacer par…' : 'Ajouter un exercice'}</span>
              <span className="head-spacer" />
            </div>
            <div className="bleed">
              <ExerciseList onPick={pick} />
            </div>
          </div>
        </div>
      )}

      <Sheet
        open={menu !== null}
        title={
          menu ? exercises.get(doc.exercises.find((e) => e.id === menu)?.exerciseId ?? '')?.name : undefined
        }
        onClose={() => setMenu(null)}
        actions={[
          {
            label: "Remplacer l'exercice",
            onClick: () => {
              setPicker({ replace: menu! });
              setMenu(null);
            },
          },
          {
            label: "Retirer l'exercice",
            kind: 'danger',
            onClick: () => {
              setDoc({ ...doc, exercises: doc.exercises.filter((e) => e.id !== menu) });
              setMenu(null);
            },
          },
        ]}
      />

      <Sheet open={restFor !== null} title="Temps de repos" onClose={() => setRestFor(null)}>
        <div className="chips wrap mt-8">
          {REST_CHOICES.map((r) => (
            <button
              key={String(r)}
              className={`chip${doc.exercises.find((e) => e.id === restFor)?.restS === r ? ' on' : ''}`}
              onClick={() => {
                const e = doc.exercises.find((x) => x.id === restFor);
                if (e) patchEntry({ ...e, restS: r });
                setRestFor(null);
              }}
            >
              {formatRest(r)}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={Boolean(editing && editingSet)}
        title="Série"
        onClose={() => setSetEdit(null)}
        actions={[
          { label: 'OK', kind: 'primary', onClick: () => setSetEdit(null) },
          {
            label: 'Supprimer la série',
            kind: 'danger',
            onClick: () => {
              if (editing)
                patchEntry({ ...editing, sets: editing.sets.filter((s) => s.id !== setEdit?.setId) });
              setSetEdit(null);
            },
          },
        ]}
      >
        {editing && editingSet && (
          <>
            <div className="field">
              <span>Type</span>
              <Seg
                stretch
                value={editingSet.kind}
                onChange={(kind) =>
                  patchEntry({
                    ...editing,
                    sets: editing.sets.map((s) => (s.id === editingSet.id ? { ...s, kind } : s)),
                  })
                }
                options={(['normal', 'warmup', 'drop', 'failure'] as SetKind[]).map((k) => ({
                  value: k,
                  label: SET_KIND_LABELS[k],
                }))}
              />
            </div>
            {editingEx &&
              ROUTINE_FIELDS(editingEx.measurement_type).map((f) => (
                <label key={f} className="field">
                  <span>
                    {f === 'weight'
                      ? `Charge cible (${weightUnitLabel(editingEx.equipment, editingEx.measurement_type, settings.units.weight)})`
                      : f === 'duration'
                        ? 'Durée cible (m:ss)'
                        : `Distance cible (${settings.units.distance})`}
                  </span>
                  <input
                    defaultValue={fieldText(editingSet, f, settings.units)}
                    inputMode={f === 'duration' ? 'numeric' : 'decimal'}
                    onBlur={(ev) => {
                      const p = parseField(ev.target.value, f, settings.units);
                      if (!p) return toast('Valeur invalide');
                      patchEntry({
                        ...editing,
                        sets: editing.sets.map((s) => (s.id === editingSet.id ? { ...s, ...p } : s)),
                      });
                    }}
                  />
                </label>
              ))}
          </>
        )}
      </Sheet>

      <Sheet
        open={confirmDelete}
        title="Supprimer la routine ?"
        onClose={() => setConfirmDelete(false)}
        actions={[
          {
            label: 'Supprimer',
            kind: 'danger',
            onClick: async () => {
              await deleteRoutine(id!);
              navigate('/seance', { replace: true });
            },
          },
          { label: 'Annuler', onClick: () => setConfirmDelete(false) },
        ]}
      >
        <p>Les séances déjà faites depuis cette routine restent dans l'historique.</p>
      </Sheet>
    </>
  );
}
