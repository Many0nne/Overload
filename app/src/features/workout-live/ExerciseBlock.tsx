import { memo, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { formatReason, formatSetValues, formatTargets } from '@/domain/format';
import { setLabels } from '@/domain/labels';
import { columnLabels, type SetField } from '@/domain/measurement';
import { previousSets } from '@/domain/previous';
import { activeTarget } from '@/domain/progression';
import type { ExerciseRow, SetKind, Settings, WorkoutExercise } from '@/domain/types';
import { initials } from '@/features/library/ExerciseList';
import { MuscleThumb } from '@/ui/BodyMap';
import { NoteField, Sheet } from '@/ui/components';
import { DotsIcon } from '@/ui/icons';
import { EXERCISE_NOTE_MAX } from '@/ui/note';
import { formatRest } from '@/ui/time';
import { KindSheet } from './KindSheet';
import { RpeSheet } from './RpeSheet';
import { type SetPatch, SetRow } from './SetRow';

const REST_CHOICES: (number | null)[] = [null, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

export type ExerciseActions = {
  onPatchSet: (entryId: string, setId: string, patch: SetPatch) => void;
  onCheck: (entryId: string, setId: string) => void;
  onSetKind: (entryId: string, setId: string, kind: SetKind) => void;
  onCopyPrevious: (entryId: string, setId: string) => void;
  onDeleteSet: (entryId: string, setId: string) => void;
  onAddSet: (entryId: string) => void;
  onNote: (entryId: string, note: string) => void;
  onRest: (entryId: string, restS: number | null) => void;
  onMove: (entryId: string, delta: -1 | 1) => void;
  onReplace: (entryId: string) => void;
  onRemove: (entryId: string) => void;
};

// Cette méthode permet d'afficher un exercice de la séance : nom, ligne d'objectif, note, repos et tableau des séries (§F7.4).
export const ExerciseBlock = memo(function ExerciseBlock(props: {
  entry: WorkoutExercise;
  exercise: ExerciseRow | undefined;
  previous: WorkoutExercise | undefined;
  units: Settings['units'];
  setBadges: Record<string, string[]>;
  entryRecord: boolean;
  goalSetId: string | undefined;
  errors: Record<string, SetField[]>;
  readOnly: boolean;
  showRest: boolean;
  rpeEnabled: boolean;
  isFirst: boolean;
  isLast: boolean;
  actions: ExerciseActions;
}) {
  const { entry, actions: a } = props;
  const [menu, setMenu] = useState(false);
  const [restSheet, setRestSheet] = useState(false);
  // Série dont la feuille de RPE est ouverte (en touchant sa case RPE).
  const [rpeFor, setRpeFor] = useState<string | null>(null);
  // Série dont la feuille de nature est ouverte (en touchant son numéro).
  const [kindFor, setKindFor] = useState<string | null>(null);
  const name = props.exercise?.name ?? 'Exercice supprimé';
  const kinds = entry.sets.map((s) => s.kind);
  const labels = setLabels(kinds);
  // biome-ignore lint/correctness/useExhaustiveDependencies: comparaison par valeur des types de série
  const prev = useMemo(() => previousSets(kinds, props.previous), [kinds.join(), props.previous]);
  const cols = columnLabels(entry.measurementType, props.units);
  const reason = entry.targetReason
    ? formatReason(entry.targetReason, entry.measurementType, props.units)
    : undefined;
  const targets = entry.sets.map(activeTarget);
  const hasTargets = targets.some(Boolean);
  // La colonne RPE suit le réglage, mais reste visible si une série porte déjà un RPE (saisi ou importé).
  const showRpe = props.rpeEnabled || entry.sets.some((s) => s.rpe !== undefined);
  const rpeIndex = entry.sets.findIndex((s) => s.id === rpeFor);
  const rpeSet = entry.sets[rpeIndex];
  const kindIndex = entry.sets.findIndex((s) => s.id === kindFor);
  const kindSet = entry.sets[kindIndex];

  return (
    <div className="ex">
      <div className="ex-top">
        {props.exercise ? (
          <MuscleThumb primary={props.exercise.primary_muscle} secondary={props.exercise.secondary_muscles} />
        ) : (
          <div className="ex-av">{initials(name)}</div>
        )}
        <Link className="name no-underline" to={`/exercise/${entry.exerciseId}`}>
          {name}
          {props.entryRecord && <span className="ml-6">🏆</span>}
        </Link>
        {!props.readOnly && (
          <button className="icon-btn" aria-label="Actions de l'exercice" onClick={() => setMenu(true)}>
            <DotsIcon />
          </button>
        )}
      </div>
      {reason && hasTargets && (
        <div className={`goal-line ${reason.direction}`}>
          <span>
            {reason.arrow} {formatTargets(targets, entry.measurementType, props.units)}
          </span>
          <span className="why">{reason.text}</span>
          {entry.repRange && (
            <span className="tag">
              {entry.repRange.min === entry.repRange.max
                ? `${entry.repRange.min} reps`
                : `${entry.repRange.min}–${entry.repRange.max} reps`}
            </span>
          )}
        </div>
      )}
      <NoteField
        className="ex-note"
        rows={1}
        maxLength={EXERCISE_NOTE_MAX}
        placeholder="Ajouter une note…"
        defaultValue={entry.note ?? ''}
        disabled={props.readOnly}
        onBlur={(e) => e.target.value !== (entry.note ?? '') && a.onNote(entry.id, e.target.value)}
      />
      {props.showRest && (
        <button className="rest-link" disabled={props.readOnly} onClick={() => setRestSheet(true)}>
          ⏱ Repos : {formatRest(entry.restS)}
        </button>
      )}
      <table className={`sets${showRpe ? ' with-rpe' : ''}`}>
        <thead>
          <tr>
            <th>Série</th>
            <th>Précédent</th>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
            {showRpe && <th>RPE</th>}
            <th>✓</th>
          </tr>
        </thead>
        <tbody>
          {entry.sets.map((s, i) => (
            <SetRow
              key={s.id}
              set={s}
              label={labels[i] ?? ''}
              type={entry.measurementType}
              units={props.units}
              previous={prev[i]}
              record={Boolean(props.setBadges[s.id]?.length)}
              goal={props.goalSetId === s.id}
              errors={props.errors[s.id] ?? []}
              readOnly={props.readOnly}
              onPatch={(id, patch) => a.onPatchSet(entry.id, id, patch)}
              showRpe={showRpe}
              onCheck={(id) => a.onCheck(entry.id, id)}
              onOpenRpe={setRpeFor}
              onOpenKind={setKindFor}
              onCopyPrevious={(id) => a.onCopyPrevious(entry.id, id)}
              onDelete={(id) => a.onDeleteSet(entry.id, id)}
            />
          ))}
        </tbody>
      </table>
      {!props.readOnly && (
        <button className="btn btn-soft btn-block btn-sm add-set" onClick={() => a.onAddSet(entry.id)}>
          + Ajouter une série
        </button>
      )}

      <Sheet
        open={menu}
        title={name}
        onClose={() => setMenu(false)}
        actions={[
          {
            label: "Remplacer l'exercice",
            onClick: () => {
              setMenu(false);
              a.onReplace(entry.id);
            },
          },
          ...(!props.isFirst
            ? [
                {
                  label: 'Monter',
                  onClick: () => {
                    setMenu(false);
                    a.onMove(entry.id, -1);
                  },
                },
              ]
            : []),
          ...(!props.isLast
            ? [
                {
                  label: 'Descendre',
                  onClick: () => {
                    setMenu(false);
                    a.onMove(entry.id, 1);
                  },
                },
              ]
            : []),
          ...(props.showRest
            ? [
                {
                  label: 'Modifier le temps de repos',
                  onClick: () => {
                    setMenu(false);
                    setRestSheet(true);
                  },
                },
              ]
            : []),
          {
            label: "Supprimer l'exercice",
            kind: 'danger' as const,
            onClick: () => {
              setMenu(false);
              a.onRemove(entry.id);
            },
          },
        ]}
      />
      <RpeSheet
        open={Boolean(rpeSet?.done) && !props.readOnly}
        subtitle={
          rpeSet
            ? `Série ${labels[rpeIndex] ?? ''} : ${formatSetValues(rpeSet, entry.measurementType, props.units)}`
            : ''
        }
        value={rpeSet?.rpe}
        onPick={(rpe) => rpeSet && a.onPatchSet(entry.id, rpeSet.id, { rpe })}
        onClose={() => setRpeFor(null)}
      />
      <KindSheet
        open={Boolean(kindSet) && !props.readOnly}
        value={kindSet?.kind ?? 'normal'}
        normalLabel={
          kindSet ? (setLabels(kinds.map((k, j) => (j === kindIndex ? 'normal' : k)))[kindIndex] ?? '') : ''
        }
        onPick={(kind) => {
          if (kindSet) a.onSetKind(entry.id, kindSet.id, kind);
          setKindFor(null);
        }}
        onClose={() => setKindFor(null)}
      />
      <Sheet open={restSheet} title={`Repos · ${name}`} onClose={() => setRestSheet(false)}>
        <div className="chips wrap mt-8">
          {REST_CHOICES.map((r) => (
            <button
              key={String(r)}
              className={`chip${entry.restS === r ? ' on' : ''}`}
              onClick={() => {
                a.onRest(entry.id, r);
                setRestSheet(false);
              }}
            >
              {formatRest(r)}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
});
