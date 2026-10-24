import { SET_KIND_LABELS, SET_KIND_SHORT } from '@/domain/labels';
import type { SetKind } from '@/domain/types';
import { Sheet } from '@/ui/components';
import { CheckIcon } from '@/ui/icons';

const KINDS: SetKind[] = ['normal', 'warmup', 'drop', 'failure'];

// Précision affichée sous chaque nature de série.
const KIND_HINTS: Record<SetKind, string> = {
  normal: 'Série de travail',
  warmup: 'Hors volume et records',
  drop: 'Charge baissée juste après la série précédente',
  failure: "Menée volontairement jusqu'à l'échec",
};

// Classe de couleur du badge, partagée avec le numéro de série du tableau.
const KIND_CLASS: Record<SetKind, string> = { normal: '', warmup: 'W', drop: 'D', failure: 'X' };

// Cette méthode permet de choisir la nature d'une série dans une feuille (§F7.4) : un toucher enregistre et referme.
// normalLabel est le numéro que prendrait la série si elle était normale.
export function KindSheet(p: {
  open: boolean;
  value: SetKind;
  normalLabel: string;
  onPick: (kind: SetKind) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={p.open} className="kind-sheet" title="Nature de la série" onClose={p.onClose}>
      <div className="kind-list">
        {KINDS.map((k) => (
          <button
            key={k}
            aria-pressed={p.value === k}
            className={`kind-opt${p.value === k ? ' on' : ''}`}
            onClick={() => p.onPick(k)}
          >
            <span className={`type ${KIND_CLASS[k]}`} aria-hidden="true">
              {k === 'normal' ? p.normalLabel : SET_KIND_SHORT[k]}
            </span>
            <span className="kind-txt">
              <span className="kind-name">{SET_KIND_LABELS[k]}</span>
              <span className="kind-hint">{KIND_HINTS[k]}</span>
            </span>
            {p.value === k && <CheckIcon />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
