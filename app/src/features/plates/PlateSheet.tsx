import { useEffect, useRef, useState } from 'react';
import { BAR_LABELS, BAR_TYPES, barCaption, loadBar, type PlateSet, plateStep } from '@/domain/plates';
import type { BarType, WeightUnit } from '@/domain/types';
import { formatNumber, parseDecimal } from '@/domain/units';
import { Sheet } from '@/ui/components';
import { PlateBar, plateText } from './PlateBar';

// Cette méthode permet d'afficher le calculateur de disques : charge réglable (− / + ou saisie libre) et barre chargée,
// ouvert depuis le menu d'un exercice à la barre en séance ou depuis sa fiche ; la barre se change par des puces.
export function PlateSheet(props: {
  open: boolean;
  subtitle: string;
  initial: number | undefined;
  unit: WeightUnit;
  plateSet: PlateSet;
  /** Poids de chaque type de barre ; avec onBar, affiche le choix de la barre (mémorisé pour l'exercice). */
  bars?: Record<BarType, number>;
  onBar?: (type: BarType) => void;
  onClose: () => void;
}) {
  const { bar } = props.plateSet;
  const [text, setText] = useState('');
  const prevBar = useRef(bar);
  // Repart de la charge de la série à chaque ouverture.
  // biome-ignore lint/correctness/useExhaustiveDependencies: la barre ne compte qu'à l'ouverture (changer de barre garde la charge)
  useEffect(() => {
    if (props.open) setText(formatNumber(props.initial ?? bar, 2));
  }, [props.open, props.initial]);
  // Changement de barre : la charge saisie est gardée, sauf la barre seule qui suit la nouvelle barre.
  useEffect(() => {
    const old = prevBar.current;
    prevBar.current = bar;
    setText((t) => (parseDecimal(t) === old ? formatNumber(bar, 2) : t));
  }, [bar]);

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
      {props.bars && props.onBar && (
        <div className="chips wrap mb-12">
          {BAR_TYPES.map((t) => (
            <button
              key={t}
              className={`chip${props.plateSet.barType === t ? ' on' : ''}`}
              aria-pressed={props.plateSet.barType === t}
              onClick={() => props.onBar?.(t)}
            >
              {BAR_LABELS[t]} · {formatNumber(props.bars![t], 2)}
            </button>
          ))}
        </div>
      )}
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
          · {barCaption(props.plateSet.barType, `${formatNumber(bar, 2)} ${props.unit}`)}
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
