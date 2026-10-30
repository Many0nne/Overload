import { useEffect, useRef, useState } from 'react';
import { formatRpe } from '@/domain/format';
import { RPE_VALUES } from '@/domain/measurement';
import { Sheet } from '@/ui/components';
import { rpeColor } from '@/ui/rpeColor';

// Libellé et équivalent en reps en réserve de chaque valeur de RPE.
const RPE_TEXT: Record<number, [string, string]> = {
  6: ['Effort modéré', "J'aurais pu faire 4 reps de plus"],
  6.5: ['Effort modéré', "J'aurais pu faire 3 à 4 reps de plus"],
  7: ['Effort soutenu', "J'aurais pu faire 3 reps de plus"],
  7.5: ['Effort soutenu', "J'aurais pu faire 2 à 3 reps de plus"],
  8: ['Effort important', "J'aurais pu faire 2 reps de plus"],
  8.5: ['Effort important', "J'aurais pu faire 1 à 2 reps de plus"],
  9: ['Effort très important', "J'aurais pu faire 1 rep de plus"],
  9.5: ['Effort quasi maximal', "J'aurais peut-être pu faire 1 rep de plus"],
  10: ['Effort maximal', "Impossible d'en faire plus"],
};

// Cette méthode permet de retrouver la valeur de RPE sous le doigt à partir de sa position horizontale sur la piste.
function valueAt(track: HTMLElement, clientX: number): number {
  const box = track.getBoundingClientRect();
  const i = Math.floor(((clientX - box.left) / box.width) * RPE_VALUES.length);
  return RPE_VALUES[Math.min(RPE_VALUES.length - 1, Math.max(0, i))]!;
}

// Cette méthode permet de saisir le RPE d'une série dans une feuille : grand chiffre, libellé, piste à toucher ou glisser.
// Le choix est enregistré dès qu'on lâche la piste ; « Terminé » ou le fond referment, « Effacer » retire la valeur.
export function RpeSheet(p: {
  open: boolean;
  subtitle: string;
  value: number | undefined;
  onPick: (rpe: number | undefined) => void;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(p.value);
  const dragging = useRef(false);
  useEffect(() => {
    if (!dragging.current) setShown(p.value);
  }, [p.value]);
  const text = shown !== undefined ? RPE_TEXT[shown] : undefined;

  return (
    <Sheet
      open={p.open}
      className="rpe-sheet"
      title="Effort ressenti (RPE)"
      onClose={p.onClose}
      actions={[{ label: 'Terminé', kind: 'primary', onClick: p.onClose }]}
    >
      <p className="rpe-sub">{p.subtitle}</p>
      <div className="rpe-big rpe-ink" aria-live="polite" style={rpeColor(shown)}>
        {shown !== undefined ? formatRpe(shown) : '–'}
      </div>
      <div className="rpe-label rpe-ink" style={rpeColor(shown)}>
        {text?.[0] ?? 'Quel effort pour cette série ?'}
      </div>
      <div className="rpe-rir">{text?.[1] ?? '10 = échec · 9 = 1 rep en réserve · 8 = 2…'}</div>
      <div
        className="rpe-track"
        onPointerDown={(e) => {
          dragging.current = true;
          setShown(valueAt(e.currentTarget, e.clientX));
        }}
        onPointerMove={(e) => {
          if (dragging.current) setShown(valueAt(e.currentTarget, e.clientX));
        }}
        onPointerUp={(e) => {
          if (!dragging.current) return;
          dragging.current = false;
          p.onPick(valueAt(e.currentTarget, e.clientX));
        }}
        onPointerCancel={() => {
          dragging.current = false;
          setShown(p.value);
        }}
      >
        {RPE_VALUES.map((v) => (
          <button
            key={v}
            aria-pressed={shown === v}
            className={shown === v ? 'on rpe-solid' : 'rpe-tint'}
            style={rpeColor(v)}
            onClick={() => p.onPick(v)}
          >
            {formatRpe(v)}
          </button>
        ))}
      </div>
      {p.value !== undefined && (
        <button className="rpe-clear" onClick={() => p.onPick(undefined)}>
          Effacer le RPE
        </button>
      )}
    </Sheet>
  );
}
