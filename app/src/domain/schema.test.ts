import { describe, expect, it } from 'vitest';
import { DOC_VERSIONS, docVersion, migrateDoc, upgradeRow, upgradeWorkoutDoc } from './schema';

describe('versions des documents (#71)', () => {
  it('lit la version, 1 par défaut si absente ou illisible', () => {
    expect(docVersion({ schemaVersion: 3 })).toBe(3);
    expect(docVersion({})).toBe(1);
    expect(docVersion({ schemaVersion: '2' })).toBe(1);
    expect(docVersion(null)).toBe(1);
  });

  it('laisse intact un document déjà à jour', () => {
    const doc = { schemaVersion: DOC_VERSIONS.workouts, title: 't', exercises: [] };
    const res = upgradeWorkoutDoc(doc);
    expect(res).toEqual({ ok: true, doc, changed: false });
    if (res.ok) expect(res.doc).toBe(doc);
  });

  it('pose la version sur un document qui n’en a pas', () => {
    expect(upgradeWorkoutDoc({ title: 't', exercises: [] })).toEqual({
      ok: true,
      doc: { schemaVersion: 2, title: 't', exercises: [] },
      changed: true,
    });
  });

  it('refuse un document plus récent que l’app', () => {
    expect(upgradeWorkoutDoc({ schemaVersion: DOC_VERSIONS.workouts + 1 })).toEqual({
      ok: false,
      version: DOC_VERSIONS.workouts + 1,
    });
  });

  it('enchaîne les migrations depuis la version du document', () => {
    const migrations = [
      (d: Record<string, unknown>) => ({ ...d, rpe: null }),
      (d: Record<string, unknown>) => ({ ...d, name: String(d.title).toUpperCase(), title: undefined }),
    ];
    expect(migrateDoc({ schemaVersion: 1, title: 'a' }, 3, migrations)).toEqual({
      ok: true,
      doc: { schemaVersion: 3, title: undefined, name: 'A', rpe: null },
      changed: true,
    });
    expect(migrateDoc({ schemaVersion: 2, title: 'b' }, 3, migrations)).toEqual({
      ok: true,
      doc: { schemaVersion: 3, title: undefined, name: 'B' },
      changed: true,
    });
  });

  it('ne touche qu’aux tables à document', () => {
    const folder = { id: 'f', name: 'Push' };
    expect(upgradeRow('folders', folder)).toEqual({ ok: true, row: folder, changed: false });
    const tombstone = { id: 'w', doc: null, deleted_at: 1 };
    expect(upgradeRow('workouts', tombstone)).toEqual({ ok: true, row: tombstone, changed: false });
    expect(upgradeRow('routines', { id: 'r', doc: { name: 'x' } })).toEqual({
      ok: true,
      row: { id: 'r', doc: { schemaVersion: 2, name: 'x' } },
      changed: true,
    });
    expect(upgradeRow('exercise_prefs', { id: 'p', doc: { schemaVersion: 9 } })).toEqual({
      ok: false,
      version: 9,
    });
  });
});
