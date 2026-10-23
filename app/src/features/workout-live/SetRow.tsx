import { memo, useEffect, useRef, useState } from 'react';
import { formatDuration, formatRpe, formatSetValues, parseDuration } from '@/domain/format';
import { fieldsFor, RPE_VALUES, type SetField } from '@/domain/measurement';
import { activeTarget } from '@/domain/progression';
import type { MeasurementType, Settings, WorkoutSet } from '@/domain/types';
import { displayDistanceNumber, displayWeightNumber, parseDecimal, parseInteger } from '@/domain/units';
import { CheckIcon } from '@/ui/icons';

type Units = Settings['units'];
export type SetPatch = Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'durationS' | 'distance' | 'rpe'>>;

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
  const t = activeTarget(set);
  if (!t) return false;
  if (field === 'weight')
    return Boolean(t.weight && set.weight && t.weight.v === set.weight.v && t.weight.u === set.weight.u);
  if (field === 'reps') return t.reps !== undefined && t.reps === set.reps;
  if (field === 'duration') return t.durationS !== undefined && t.durationS === set.durationS;
  return false;
}

// Cette méthode permet de sélectionner toute la valeur d'un champ qui prend le focus, pour que la frappe la remplace,
// y compris sous Safari où le toucher replace le curseur juste après le focus (sélection refaite au tour suivant,
// seulement si rien n'a été tapé entre-temps : sinon les premiers chiffres seraient resélectionnés puis écrasés).
function selectAll(el: HTMLInputElement): void {
  el.select();
  const initial = el.value;
  setTimeout(() => {
    if (document.activeElement === el && el.value === initial) el.setSelectionRange(0, el.value.length);
  }, 0);
}

// Noms lus par VoiceOver pour les champs d'une série.
const FIELD_LABELS: Record<SetField, string> = {
  weight: 'Poids',
  reps: 'Répétitions',
  duration: 'Durée',
  distance: 'Distance',
};

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
  const justFocused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(external);
  }, [external]);
  const mode = props.field === 'reps' ? 'numeric' : props.field === 'duration' ? 'numeric' : 'decimal';
  return (
    <input
      className={`val${props.target ? ' tgt' : ''}${props.error ? ' err' : ''}`}
      inputMode={mode}
      value={text}
      placeholder={props.placeholder}
      disabled={props.disabled}
      aria-label={FIELD_LABELS[props.field]}
      onFocus={(e) => {
        focused.current = true;
        justFocused.current = true;
        selectAll(e.currentTarget);
      }}
      onMouseUp={(e) => {
        // Safari place le curseur au relâchement du toucher qui donne le focus, ce qui annule la sélection.
        if (justFocused.current) e.preventDefault();
        justFocused.current = false;
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
// Déplacement minimal avant de trancher entre glissement horizontal (suppression) et défilement vertical.
const SWIPE_SLOP_PX = 10;

type SwipeState = { id: number; x: number; y: number; dx: number; active: boolean };

// Cette méthode permet de supprimer une série par glissement vers la gauche sans re-rendu React pendant le geste :
// la ligne suit le doigt via une variable CSS (mise à jour par requestAnimationFrame) et le défilement vertical reste libre.
function useSwipeToDelete(disabled: boolean, onDelete: () => void) {
  const ref = useRef<HTMLTableRowElement>(null);
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  useEffect(() => {
    const row = ref.current;
    if (!row || disabled) return;
    let s: SwipeState | null = null;
    let frame = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    let swallowClick = false;

    // Cette méthode permet d'appliquer le décalage courant à la ligne au prochain rafraîchissement d'écran.
    const paint = () => {
      frame = 0;
      const dx = s?.dx ?? 0;
      row.style.setProperty('--swipe-x', `${dx}px`);
      row.classList.toggle('swipe-armed', dx < -SWIPE_DELETE_PX);
    };
    // Cette méthode permet de terminer le geste : suppression si le seuil est franchi, sinon retour animé en place.
    const end = (commit: boolean) => {
      const wasActive = s?.active;
      const deleted = commit && wasActive && s!.dx < -SWIPE_DELETE_PX;
      if (wasActive && row.hasPointerCapture(s!.id)) row.releasePointerCapture(s!.id);
      s = null;
      if (!wasActive) return;
      swallowClick = true;
      setTimeout(() => (swallowClick = false), 0);
      cancelAnimationFrame(frame);
      frame = 0;
      row.classList.remove('swiping');
      paint();
      settle = setTimeout(() => row.classList.remove('swipe'), 200);
      if (deleted) onDeleteRef.current();
    };

    const down = (e: PointerEvent) => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      s = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, active: false };
    };
    const move = (e: PointerEvent) => {
      if (!s || e.pointerId !== s.id) return;
      const ddx = e.clientX - s.x;
      const ddy = e.clientY - s.y;
      if (!s.active) {
        if (Math.abs(ddy) > SWIPE_SLOP_PX && Math.abs(ddy) >= Math.abs(ddx)) {
          s = null; // Geste vertical : on laisse défiler la page.
          return;
        }
        if (Math.abs(ddx) <= SWIPE_SLOP_PX || Math.abs(ddx) <= Math.abs(ddy)) return;
        s.active = true;
        s.x = e.clientX; // Repart du point de décision pour éviter un saut de 10 px.
        clearTimeout(settle);
        try {
          row.setPointerCapture(s.id);
        } catch {
          // Pointeur déjà relâché : le geste se termine normalement à pointerup.
        }
        row.classList.add('swipe', 'swiping');
        if (row.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      }
      s.dx = Math.min(0, e.clientX - s.x);
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const up = () => end(true);
    const cancel = () => end(false);
    // Filet de sécurité iOS : une fois le glissement engagé, le navigateur ne doit plus faire défiler la page.
    const touchMove = (e: TouchEvent) => {
      if (s?.active && e.cancelable) e.preventDefault();
    };
    // Un glissement terminé sur un bouton ne doit pas le déclencher.
    const click = (e: MouseEvent) => {
      if (!swallowClick) return;
      e.stopPropagation();
      e.preventDefault();
    };

    row.addEventListener('pointerdown', down);
    row.addEventListener('pointermove', move);
    row.addEventListener('pointerup', up);
    row.addEventListener('pointercancel', cancel);
    row.addEventListener('touchmove', touchMove, { passive: false });
    row.addEventListener('click', click, true);
    return () => {
      row.removeEventListener('pointerdown', down);
      row.removeEventListener('pointermove', move);
      row.removeEventListener('pointerup', up);
      row.removeEventListener('pointercancel', cancel);
      row.removeEventListener('touchmove', touchMove);
      row.removeEventListener('click', click, true);
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      row.classList.remove('swipe', 'swiping', 'swipe-armed');
      row.style.removeProperty('--swipe-x');
    };
  }, [disabled]);

  return ref;
}

// Cette méthode permet de rappeler l'équivalence en reps en réserve d'un RPE (« 2 reps en réserve »).
function rirHint(rpe: number | undefined): string {
  if (rpe === undefined) return '10 = échec · 9 = 1 rep en réserve · 8 = 2…';
  const rir = 10 - rpe;
  if (rir === 0) return 'Échec : aucune rep en réserve';
  return `${formatRpe(rir)} rep${rir > 1 ? 's' : ''} en réserve`;
}

// Cette méthode permet de choisir le RPE d'une série validée : une puce par demi-point, la puce active l'efface.
function RpePicker(p: {
  value: number | undefined;
  colSpan: number;
  onPick: (rpe: number | undefined) => void;
  onClose: () => void;
}) {
  return (
    <tr className="rpe-row">
      <td className="rpe-cell" colSpan={p.colSpan}>
        <div className="rpe-head">
          <span>
            Effort ressenti (RPE) <span className="muted">· {rirHint(p.value)}</span>
          </span>
          <button className="rpe-close" aria-label="Fermer le choix du RPE" onClick={p.onClose}>
            ×
          </button>
        </div>
        <div className="chips wrap rpe-chips">
          {RPE_VALUES.map((v) => (
            <button
              key={v}
              className={`chip${p.value === v ? ' on' : ''}`}
              aria-pressed={p.value === v}
              onClick={() => p.onPick(p.value === v ? undefined : v)}
            >
              {formatRpe(v)}
            </button>
          ))}
        </div>
      </td>
    </tr>
  );
}

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
  rpeOpen: boolean;
  onPatch: (setId: string, patch: SetPatch) => void;
  onCheck: (setId: string) => void;
  onOpenRpe: (setId: string) => void;
  onPickRpe: (setId: string, rpe: number | undefined) => void;
  onCycleKind: (setId: string) => void;
  onCopyPrevious: (setId: string) => void;
  onDelete: (setId: string) => void;
};

// Cette méthode permet d'afficher une ligne de série : type, « Précédent », champs du type de mesure et coche (§F7.4).
// Un glissement de plus de 80 px vers la gauche supprime la série. Une série validée affiche son RPE et, ouverte, son choix.
export const SetRow = memo(function SetRow(p: SetRowProps) {
  const fields = fieldsFor(p.type);
  const rowRef = useSwipeToDelete(p.readOnly, () => p.onDelete(p.set.id));
  const kindClass = { normal: '', warmup: 'W', drop: 'D', failure: 'X' }[p.set.kind];

  const showPicker = p.rpeOpen && p.set.done && !p.readOnly;

  return (
    <>
      <tr ref={rowRef} className={`set${p.set.done ? ' done' : ''}${p.record ? ' pr' : ''}`}>
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
          <button
            className="prev"
            disabled={p.readOnly || !p.previous}
            onClick={() => p.onCopyPrevious(p.set.id)}
          >
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
          {p.set.done && p.set.rpe !== undefined && (
            <button
              className="rpe-badge"
              disabled={p.readOnly}
              aria-label={`RPE ${formatRpe(p.set.rpe)}, modifier`}
              onClick={() => p.onOpenRpe(p.set.id)}
            >
              RPE {formatRpe(p.set.rpe)}
            </button>
          )}
        </td>
      </tr>
      {showPicker && (
        <RpePicker
          value={p.set.rpe}
          colSpan={fields.length + 3}
          onPick={(rpe) => p.onPickRpe(p.set.id, rpe)}
          onClose={() => p.onOpenRpe(p.set.id)}
        />
      )}
    </>
  );
});
