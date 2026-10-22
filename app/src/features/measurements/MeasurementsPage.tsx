import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '@/data/db';
import { useSettings } from '@/data/queries';
import { deleteMeasurement, saveMeasurement } from '@/data/repositories';
import { dayKey, parseDayKey } from '@/domain/dates';
import { measurementSeries } from '@/domain/stats';
import type { BodyMeasurementKey, BodyMeasurementRow, BodyMeasurementValues, Settings } from '@/domain/types';
import {
  CM_PER_IN,
  displayLengthNumber,
  displayWeightNumber,
  formatNumber,
  kgTo,
  parseDecimal,
} from '@/domain/units';
import { Chips, Sheet, SubHead, toast } from '@/ui/components';
import { LineChart } from '@/ui/LineChart';

const KEYS: { key: BodyMeasurementKey; label: string }[] = [
  { key: 'weight', label: 'Poids' },
  { key: 'body_fat', label: '% MG' },
  { key: 'neck', label: 'Cou' },
  { key: 'shoulders', label: 'Épaules' },
  { key: 'chest', label: 'Poitrine' },
  { key: 'arm_left', label: 'Bras G' },
  { key: 'arm_right', label: 'Bras D' },
  { key: 'waist', label: 'Taille' },
  { key: 'hips', label: 'Hanches' },
  { key: 'thigh_left', label: 'Cuisse G' },
  { key: 'thigh_right', label: 'Cuisse D' },
  { key: 'calf_left', label: 'Mollet G' },
  { key: 'calf_right', label: 'Mollet D' },
];

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
type Units = Settings['units'];

// Cette méthode permet d'obtenir l'unité affichée d'une mesure (kg/lb, %, cm/in).
function unitOf(key: BodyMeasurementKey, units: Units): string {
  if (key === 'weight') return units.weight;
  if (key === 'body_fat') return '%';
  return units.length;
}

// Cette méthode permet de convertir une valeur canonique de série (kg, %, cm) dans l'unité de l'utilisateur.
function toDisplay(v: number, key: BodyMeasurementKey, units: Units): number {
  if (key === 'weight') return kgTo(v, units.weight);
  if (key === 'body_fat') return v;
  return units.length === 'cm' ? v : v / CM_PER_IN;
}

// Cette méthode permet d'afficher la valeur saisie d'une mesure dans le formulaire, sans unité ('' si absente).
function fieldText(values: BodyMeasurementValues, key: BodyMeasurementKey, units: Units): string {
  if (key === 'weight') return values.weight ? displayWeightNumber(values.weight, units.weight) : '';
  if (key === 'body_fat') return values.body_fat !== undefined ? formatNumber(values.body_fat) : '';
  const l = values[key];
  return l ? displayLengthNumber(l, units.length) : '';
}

// Cette méthode permet d'afficher la saisie datée des mesures corporelles et la courbe de chaque mesure (§F7.6).
export default function MeasurementsPage() {
  const settings = useSettings();
  const units = settings.units;
  const rows = useLiveQuery(
    () =>
      db.body_measurements
        .orderBy('measured_on')
        .filter((r) => r.deleted_at == null)
        .toArray(),
    [],
  );
  const [key, setKey] = useState<BodyMeasurementKey>('weight');
  const [editing, setEditing] = useState<BodyMeasurementRow | 'new' | null>(null);

  const series = useMemo(() => measurementSeries(rows ?? [], key), [rows, key]);
  const entries = useMemo(
    () => [...(rows ?? [])].reverse().filter((r) => r.values[key] !== undefined),
    [rows, key],
  );
  const last = series.at(-1);
  const first = series[0];
  const delta = last && first ? last.v - first.v : 0;
  const format = (v: number) => `${formatNumber(toDisplay(v, key, units))} ${unitOf(key, units)}`;
  const axis = (v: number) => formatNumber(toDisplay(v, key, units));
  const label = KEYS.find((k) => k.key === key)?.label ?? '';

  return (
    <>
      <SubHead
        title="Mesures"
        right={
          <button className="btn-ghost" style={{ fontWeight: 650 }} onClick={() => setEditing('new')}>
            Ajouter
          </button>
        }
      />
      <Chips
        value={key}
        options={KEYS.map((k) => ({ value: k.key, label: k.label }))}
        onChange={(v) => v && setKey(v)}
      />
      <div className="section" style={{ marginTop: 10 }}>
        <div className="muted" style={{ fontSize: '.8125rem' }}>
          {label} · dernière mesure
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div className="hero">{last ? format(last.v) : '—'}</div>
          {series.length > 1 && (
            <span className="delta" style={{ color: 'var(--text-2)' }}>
              {delta >= 0 ? '▲ +' : '▼ '}
              {format(Math.abs(delta))} depuis le début
            </span>
          )}
        </div>
        {series.length > 1 ? (
          <LineChart points={series} format={format} axis={axis} ariaLabel={`Évolution : ${label}`} />
        ) : (
          <p className="empty">
            {series.length === 0
              ? 'Aucune mesure enregistrée.'
              : 'Ajoute une deuxième mesure pour voir la courbe.'}
          </p>
        )}
      </div>
      {entries.length > 0 && (
        <div className="section">
          <div className="section-title">Historique</div>
          <div className="card">
            <ul className="rec-list">
              {entries.map((r) => (
                <li key={r.id} onClick={() => setEditing(r)} style={{ cursor: 'pointer' }}>
                  <span>{dateFmt.format(parseDayKey(r.measured_on))}</span>
                  <b>
                    {fieldText(r.values, key, units)} {unitOf(key, units)}
                  </b>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {editing && (
        <MeasurementSheet
          row={editing === 'new' ? undefined : editing}
          units={units}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

// Cette méthode permet de saisir ou modifier les mesures d'une date ; un champ inchangé garde sa valeur et son unité d'origine.
function MeasurementSheet(props: { row?: BodyMeasurementRow; units: Units; onClose: () => void }) {
  const { row, units } = props;
  const initial = useMemo(
    () => Object.fromEntries(KEYS.map((k) => [k.key, row ? fieldText(row.values, k.key, units) : ''])),
    [row, units],
  ) as Record<BodyMeasurementKey, string>;
  const [date, setDate] = useState(row?.measured_on ?? dayKey(Date.now()));
  const [texts, setTexts] = useState(initial);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Cette méthode permet de construire les valeurs à enregistrer ; renvoie le nom du champ invalide le cas échéant.
  const build = (): BodyMeasurementValues | string => {
    const out: BodyMeasurementValues = {};
    for (const { key, label } of KEYS) {
      const text = texts[key].trim();
      if (!text) continue;
      if (row && text === initial[key] && row.values[key] !== undefined) {
        (out as Record<string, unknown>)[key] = row.values[key];
        continue;
      }
      const n = parseDecimal(text);
      if (n === undefined || n <= 0 || (key === 'body_fat' && n >= 100)) return label;
      if (key === 'weight') out.weight = { v: n, u: units.weight };
      else if (key === 'body_fat') out.body_fat = n;
      else out[key] = { v: n, u: units.length };
    }
    return out;
  };

  // Cette méthode permet d'enregistrer la saisie après validation (au moins une valeur, nombres valides, date non future).
  const save = async () => {
    const values = build();
    if (typeof values === 'string') return toast(`Valeur invalide : ${values}`);
    if (Object.keys(values).length === 0) return toast('Saisis au moins une mesure');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > dayKey(Date.now())) return toast('Date invalide');
    await saveMeasurement({ id: row?.id, measured_on: date, values });
    toast('Mesures enregistrées');
    props.onClose();
  };

  if (confirmDelete && row) {
    return (
      <Sheet
        open
        title="Supprimer ces mesures ?"
        onClose={() => setConfirmDelete(false)}
        actions={[
          {
            label: 'Supprimer',
            kind: 'danger',
            onClick: async () => {
              await deleteMeasurement(row.id);
              toast('Mesures supprimées');
              props.onClose();
            },
          },
          { label: 'Annuler', kind: 'ghost', onClick: () => setConfirmDelete(false) },
        ]}
      />
    );
  }

  return (
    <Sheet
      open
      title={row ? 'Modifier les mesures' : 'Nouvelles mesures'}
      onClose={props.onClose}
      actions={[
        { label: 'Enregistrer', kind: 'primary', onClick: save },
        ...(row
          ? [{ label: 'Supprimer', kind: 'danger' as const, onClick: () => setConfirmDelete(true) }]
          : []),
      ]}
    >
      <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
        <label className="field" style={{ marginTop: 0 }}>
          <span>Date</span>
          <input
            type="date"
            value={date}
            max={dayKey(Date.now())}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <div className="field-row">
          {KEYS.map(({ key, label }) => (
            <label key={key} className="field">
              <span>
                {label} ({unitOf(key, units)})
              </span>
              <input
                inputMode="decimal"
                value={texts[key]}
                onChange={(e) => setTexts((t) => ({ ...t, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
