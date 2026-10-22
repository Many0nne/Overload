import { useState } from 'react';
import type { ExerciseInput } from '@/data/repositories';
import {
  EQUIPMENT_LABELS,
  EQUIPMENTS,
  MEASUREMENT_LABELS,
  MEASUREMENT_TYPES,
  MUSCLE_LABELS,
  MUSCLES,
} from '@/domain/labels';
import type { Equipment, ExerciseRow, MeasurementType, Muscle } from '@/domain/types';

// Cette méthode permet de saisir ou modifier un exercice (nom, équipement, muscles, type de mesure, consignes).
// Le type de mesure est verrouillé quand `typeLocked` est vrai (exercice déjà utilisé ou du catalogue, §F7.2).
export function ExerciseForm(props: {
  initial?: ExerciseRow;
  typeLocked: boolean;
  submitLabel: string;
  onSubmit: (input: ExerciseInput) => void | Promise<void>;
}) {
  const i = props.initial;
  const [name, setName] = useState(i?.name ?? '');
  const [equipment, setEquipment] = useState<Equipment>(i?.equipment ?? 'barbell');
  const [primary, setPrimary] = useState<Muscle>(i?.primary_muscle ?? 'chest');
  const [secondary, setSecondary] = useState<Muscle[]>(i?.secondary_muscles ?? []);
  const [type, setType] = useState<MeasurementType>(i?.measurement_type ?? 'weight_reps');
  const [instructions, setInstructions] = useState(i?.instructions ?? '');
  const [error, setError] = useState<string | null>(null);

  // Cette méthode permet d'ajouter ou retirer un muscle secondaire.
  const toggleSecondary = (m: Muscle) =>
    setSecondary((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]));

  return (
    <div className="section" style={{ marginTop: 0 }}>
      <label className="field" style={{ marginTop: 0 }}>
        <span>Nom</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Hip thrust (barre)" />
      </label>
      <div className="field">
        <span>Équipement</span>
        <div className="chips wrap">
          {EQUIPMENTS.map((e) => (
            <button key={e} className={`chip${equipment === e ? ' on' : ''}`} onClick={() => setEquipment(e)}>
              {EQUIPMENT_LABELS[e]}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Muscle principal</span>
        <div className="chips wrap">
          {MUSCLES.map((m) => (
            <button key={m} className={`chip${primary === m ? ' on' : ''}`} onClick={() => setPrimary(m)}>
              {MUSCLE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Muscles secondaires</span>
        <div className="chips wrap">
          {MUSCLES.filter((m) => m !== primary).map((m) => (
            <button
              key={m}
              className={`chip${secondary.includes(m) ? ' on' : ''}`}
              onClick={() => toggleSecondary(m)}
            >
              {MUSCLE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Type de mesure{props.typeLocked ? ' (figé)' : ''}</span>
        <div className="chips wrap">
          {MEASUREMENT_TYPES.map((t) => (
            <button
              key={t}
              disabled={props.typeLocked && t !== type}
              style={props.typeLocked && t !== type ? { opacity: 0.4 } : undefined}
              className={`chip${type === t ? ' on' : ''}`}
              onClick={() => !props.typeLocked && setType(t)}
            >
              {MEASUREMENT_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>Consignes (une étape par ligne)</span>
        <textarea rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </label>
      {error && <p className="error-text">{error}</p>}
      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 18, height: 52 }}
        onClick={() => {
          if (!name.trim()) return setError('Donne un nom à l’exercice.');
          void props.onSubmit({
            name: name.trim(),
            equipment,
            primary_muscle: primary,
            secondary_muscles: secondary.filter((m) => m !== primary),
            measurement_type: type,
            instructions: instructions.trim() || null,
          });
        }}
      >
        {props.submitLabel}
      </button>
    </div>
  );
}
