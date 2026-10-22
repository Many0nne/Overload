import { memo, useEffect, useRef, useState } from 'react';
import { formatDuration, formatSetValues, parseDuration } from '@/domain/format';
import { fieldsFor, type SetField } from '@/domain/measurement';
import type { MeasurementType, Settings, WorkoutSet } from '@/domain/types';
import { displayDistanceNumber, displayWeightNumber, parseDecimal, parseInteger } from '@/domain/units';
import { CheckIcon } from '@/ui/icons';

type Units = Settings['units'];
export type SetPatch = Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'durationS' | 'distance'>>;

// Cette méthode permet d'afficher la valeur d'un champ de série dans l'unité de l'utilisateur.
export function fieldText(set: Partial<WorkoutSet>, field: SetField, units: Units): string {
  if (field === 'weight') return set.weight ? displayWeightNumber(set.weight, units.weight) : '';
  if (field === 'reps') return set.reps !== undefined ? String(set.reps) : '';
  if (field === 'duration') return set.durationS !== undefined ? formatDuration(set.durationS) : '';
  return set.distance ? displayDistanceNumber(set.distance, units.distance) : '';
}

// Cette méthode permet de transformer une saisie texte en valeur de série ; null = saisie invalide, {} = champ vidé.
export function parseField(text: string, field: SetField, units: Units): SetPatch | null {
  const t = text.trim();
  if (field === 'weight') {
    if (!t) return { weight: undefined };
    const v = parseDecimal(t);
    return v === undefined || v < 0 ? null : { weight: { v, u: units.weight } };
  }
  if (field === 'reps') {
    if (!t) return { reps: undefined };
    const v = parseInteger(t);
    return v === undefined || v < 0 ? null : { reps: v };
  }
  if (field === 'duration') {
    if (!t) return { durationS: undefined };
    const v = parseDuration(t);
    return v === undefined ? null : { durationS: v };
  }
  if (!t) return { distance: undefined };
  const v = parseDecimal(t);
  return v === undefined || v < 0 ? null : { distance: { v, u: units.distance } };
}

// Cette méthode permet de savoir si un champ affiche encore la valeur de l'objectif (style bleu « pré-rempli »).
function isTargetValue(set: WorkoutSet, field: SetField): boolean {
  const t = set.target;
  if (!t) return false;
  if (field === 'weight') return Boolean(t.weight && set.weight && t.weight.v === set.weight.v && t.weight.u === set.weight.u);
  if (field === 'reps') return t.reps !== undefined && t.reps === set.reps;
  if (field === 'duration') return t.durationS !== undefined && t.durationS === set.durationS;
  return false;
}

// Cette méthode permet de saisir un champ numérique : texte libre pendant la frappe (« 82, »), valeur validée à chaque changement.
function ValueInput(props: {
  field: SetField;
  set: WorkoutSet;
  units: Units;
  placeholder: string;
  target: boolean;
  error: boolean;
  disabled: boolean;
  onCommit: (patch: SetPatch) => void;
}) {
  const external = fieldText(props.set, props.field, props.units);
  const [text, setText] = useState(external);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(external);
  }, [external]);
  const mode = props.field === 'reps' ? 'numeric' : props.field === 'duration' ? 'text' : 'decimal';
  return (
    <input
      className={`val${props.target ? ' tgt' : ''}${props.error ? ' err' : ''}`}
      inputMode={mode}
      value={text}
      placeholder={props.placeholder}
      disabled={props.disabled}
      aria-label={props.field}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
      }}
      onBlur={() => {
        focused.current = false;
        const p = parseField(text, props.field, props.units);
        if (!p) return setText(external);
        if (props.field === 'duration') {
          props.onCommit(p);
          setText(fieldText({ ...props.set, ...p }, 'duration', props.units));
        }
      }}
      onChange={(e) => {
        setText(e.target.value);
        const p = parseField(e.target.value, props.field, props.units);
        if (p && props.field !== 'duration') props.onCommit(p);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
      }}
    />
  );
}

const SWIPE_DELETE_PX = 80;

export type SetRowProps = {
  set: WorkoutSet;
  label: string;
  type: MeasurementType;
  units: Units;
  previous: WorkoutSet | undefined;
  record: boolean;
  goal: boolean;
  errors: SetField[];
  readOnly: boolean;
  onPatch: (setId: string, patch: SetPatch) => void;
  onCheck: (setId: string) => void;
  onCycleKind: (setId: string) => void;
  onCopyPrevious: (setId: string) => void;
  onDelete: (setId: string) => void;
};

// Cette méthode permet d'afficher une ligne de série : type, « Précédent », champs du type de mesure et coche (§F7.4).
// Un glissement de plus de 80 px vers la gauche supprime la série.
export const SetRow = memo(function SetRow(p: SetRowProps) {
  const fields = fieldsFor(p.type);
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const kindClass = { normal: '', warmup: 'W', drop: 'D', failure: 'X' }[p.set.kind];

  return (
    <tr
      className={`set${p.set.done ? ' done' : ''}${p.record ? ' pr' : ''}`}
      style={dx ? { transform: `translateX(${dx}px)`, background: dx < -SWIPE_DELETE_PX ? 'color-mix(in srgb, var(--fail) 25%, transparent)' : undefined } : undefined}
      onPointerDown={(e) => {
        if (p.readOnly || (e.target as HTMLElement).closest('input,button')) return;
        start.current = { x: e.clientX, y: e.clientY, active: false };
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        const ddx = e.clientX - s.x;
        if (!s.active && Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(e.clientY - s.y)) s.active = true;
        if (s.active) setDx(Math.min(0, ddx));
      }}
      onPointerUp={() => {
        if (start.current?.active && dx < -SWIPE_DELETE_PX) p.onDelete(p.set.id);
        start.current = null;
        setDx(0);
      }}
      onPointerCancel={() => {
        start.current = null;
        setDx(0);
      }}
    >
      <td>
        <button
          className={`type ${kindClass}`}
          disabled={p.readOnly}
          aria-label="Changer le type de série"
          onClick={() => p.onCycleKind(p.set.id)}
        >
          {p.label}
        </button>
      </td>
      <td>
        <button className="prev" disabled={p.readOnly || !p.previous} onClick={() => p.onCopyPrevious(p.set.id)}>
          {p.previous ? formatSetValues(p.previous, p.type, p.units) : '—'}
        </button>
      </td>
      {fields.map((f) => (
        <td key={f}>
          <ValueInput
            field={f}
            set={p.set}
            units={p.units}
            placeholder={p.previous ? fieldText(p.previous, f, p.units) : ''}
            target={!p.set.done && isTargetValue(p.set, f)}
            error={p.errors.includes(f)}
            disabled={p.readOnly}
            onCommit={(patch) => p.onPatch(p.set.id, patch)}
          />
        </td>
      ))}
      <td>
        <button
          className="check"
          disabled={p.readOnly}
          aria-label={p.set.done ? 'Annuler la validation' : 'Valider la série'}
          onClick={() => p.onCheck(p.set.id)}
        >
          <CheckIcon />
        </button>
        <span className="trophy">🏆</span>
        {p.goal && <span style={{ fontSize: '.8125rem', marginLeft: 2 }}>🎯</span>}
      </td>
    </tr>
  );
});
