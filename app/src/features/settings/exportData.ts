import { db } from '@/data/db';
import { useSession } from '@/data/session';
import { syncNow } from '@/data/sync/scheduler';
import type { SetKind } from '@/domain/types';

const KIND_FR: Record<SetKind, string> = {
  normal: 'Normale',
  warmup: 'Échauffement',
  drop: 'Dégressive',
  failure: 'Échec',
};

// Cette méthode permet d'échapper une cellule CSV (séparateur ;, guillemets doublés).
function cell(v: unknown): string {
  if (v === undefined || v === null) return '';
  const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Cette méthode permet de construire le CSV des séances : une ligne par série, UTF-8 avec BOM pour Excel FR (§14).
export async function buildCsv(): Promise<string> {
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e.name]));
  const workouts = (await db.workouts.orderBy('started_at').toArray()).filter(
    (w) => w.status === 'completed' && w.deleted_at == null,
  );
  const header = [
    'date',
    'titre',
    'exercice',
    'type de série',
    'poids',
    'unité',
    'reps',
    'durée (s)',
    'distance',
    'unité distance',
    'poids visé',
    'reps visées',
    'durée visée (s)',
    'note',
  ];
  const lines = [header.join(';')];
  for (const w of workouts) {
    const date = new Date(w.started_at).toLocaleString('fr-FR');
    for (const ex of w.doc.exercises) {
      for (const s of ex.sets) {
        if (!s.done) continue;
        lines.push(
          [
            date,
            w.doc.title,
            exercises.get(ex.exerciseId) ?? ex.exerciseId,
            KIND_FR[s.kind],
            s.weight?.v,
            s.weight?.u,
            s.reps,
            s.durationS,
            s.distance?.v,
            s.distance?.u,
            s.target?.weight?.v,
            s.target?.reps,
            s.target?.durationS,
            ex.note,
          ]
            .map(cell)
            .join(';'),
        );
      }
    }
  }
  return `﻿${lines.join('\r\n')}`;
}

// Cette méthode permet de rassembler toutes les données du compte dans un document JSON (§14).
export async function buildJson(): Promise<string> {
  const userId = useSession.getState().userId;
  const live = <T extends { deleted_at?: number | null }>(rows: T[]) =>
    rows.filter((r) => r.deleted_at == null);
  const data = {
    exportedAt: new Date().toISOString(),
    app: 'Overload',
    profile: await db.profiles.get(userId ?? ''),
    workouts: live(await db.workouts.toArray()),
    routines: live(await db.routines.toArray()),
    folders: live(await db.folders.toArray()),
    customExercises: live(
      await db.exercises
        .where('user_id')
        .equals(userId ?? '')
        .toArray(),
    ),
    exercisePrefs: live(await db.exercise_prefs.toArray()),
    bodyMeasurements: live(await db.body_measurements.toArray()),
  };
  return JSON.stringify(data, null, 2);
}

// Cette méthode permet de lancer l'export : synchro complète, puis partage (iOS) ou téléchargement des deux fichiers.
export async function exportData(): Promise<void> {
  try {
    await syncNow();
  } catch {
    // hors ligne : on exporte les données locales
  }
  const day = new Date().toISOString().slice(0, 10);
  const files = [
    new File([await buildJson()], `overload-export-${day}.json`, { type: 'application/json' }),
    new File([await buildCsv()], `overload-seances-${day}.csv`, { type: 'text/csv;charset=utf-8' }),
  ];
  if (navigator.canShare?.({ files })) {
    await navigator.share({ files, title: 'Export Overload' });
    return;
  }
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
