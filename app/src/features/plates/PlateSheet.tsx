import { useEffect, useState } from 'react';
import { loadBar, type PlateSet, plateStep } from '@/domain/plates';
import type { WeightUnit } from '@/domain/types';
import { formatNumber, parseDecimal } from '@/domain/units';
import { Sheet } from '@/ui/components';
import { PlateBar, plateText } from './PlateBar';

// Cette méthode permet d'afficher le calculateur de disques : charge réglable (− / + ou saisie libre) et barre chargée,
// ouvert depuis le menu d'un exercice à la barre en séance ou depuis sa fiche.
export function PlateSheet(props: {
  open: boolean;
  subtitle: string;
  initial: number | undefined;
  unit: WeightUnit;
  plateSet: PlateSet;
  onClose: () => void;
}) {
  const { bar } = props.plateSet;
  const [text, setText] = useState('');
  // Repart de la charge de la série à chaque ouverture.
  useEffect(() => {
    if (props.open) setText(formatNumber(props.initial ?? bar, 2));
  }, [props.open, props.initial, bar]);

  const total = parseDecimal(text);
  const load = total !== undefined ? loadBar(total, props.plateSet) : undefined;
  const step = plateStep(props.plateSet);
  // Cette méthode permet d'ajouter ou retirer une paire du plus petit disque, sans descendre sous la barre.
  const bump = (dir: 1 | -1) => {
    const v = Math.max(bar, Math.round(((total ?? bar) + dir * step) / step) * step);
    setText(formatNumber(v, 2));
  };

  return (
    <Sheet open={props.open} title="Disques à charger" onClose={props.onClose} className="plate-sheet">
      <p className="plate-sub">{props.subtitle}</p>
      <div className="plate-total">
        <button className="plate-step" aria-label="Retirer une paire de disques" onClick={() => bump(-1)}>
          −
        </button>
        <label className="plate-input">
          <input
            inputMode="decimal"
            aria-label="Charge totale"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
          />
          <span>{props.unit}</span>
        </label>
        <button className="plate-step" aria-label="Ajouter une paire de disques" onClick={() => bump(1)}>
          +
        </button>
      </div>
      <div className="plate-drawing">
        <PlateBar perSide={load?.perSide ?? []} unit={props.unit} full height={86} />
      </div>
      <p className="plate-side">
        {load?.belowBar ? (
          <span className="c-warm">Sous le poids de la barre</span>
        ) : (
          <>
            Par côté : <b>{plateText(load?.perSide ?? [])}</b>
          </>
        )}
        <span className="muted">
          {' '}
          · barre {formatNumber(bar, 2)} {props.unit}
        </span>
      </p>
      {load && load.rest > 0 && (
        <p className="plate-side c-warm">
          {formatNumber(load.rest, 2)} {props.unit} impossibles : {formatNumber(load.loaded, 2)} {props.unit}{' '}
          chargés
        </p>
      )}
    </Sheet>
  );
}
