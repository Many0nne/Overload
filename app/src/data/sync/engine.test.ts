import { describe, expect, it } from 'vitest';
import { shouldApply } from './engine';

const ME = '55555555-5555-7555-8555-555555555555';
const LOW = '11111111-1111-7111-8111-111111111111';
const HIGH = '99999999-9999-7999-8999-999999999999';
const pending = { seq: 1, table: 'folders' as const, row_id: 'f1', client_updated_at: 1000 };

describe('shouldApply (§6.3)', () => {
  it('applique toute ligne sans modification locale en attente', () => {
    expect(shouldApply('folders', { client_updated_at: 1, client_device_id: LOW }, undefined, ME)).toBe(true);
  });

  it('garde la modification en attente face à une version plus ancienne, cède face à une plus récente', () => {
    expect(shouldApply('folders', { client_updated_at: 999, client_device_id: HIGH }, pending, ME)).toBe(
      false,
    );
    expect(shouldApply('folders', { client_updated_at: 1001, client_device_id: LOW }, pending, ME)).toBe(
      true,
    );
  });

  it('à égalité, départage par l’identifiant d’appareil comme le serveur', () => {
    expect(shouldApply('folders', { client_updated_at: 1000, client_device_id: LOW }, pending, ME)).toBe(
      false,
    );
    expect(shouldApply('folders', { client_updated_at: 1000, client_device_id: HIGH }, pending, ME)).toBe(
      true,
    );
    expect(shouldApply('folders', { client_updated_at: 1000, client_device_id: ME }, pending, ME)).toBe(
      false,
    );
  });

  it('applique toujours une séance en cours reprise par un autre appareil', () => {
    const w = {
      client_updated_at: 1,
      client_device_id: LOW,
      status: 'in_progress',
      owner_device_id: LOW,
      deleted_at: null,
    };
    expect(shouldApply('workouts', w, { ...pending, table: 'workouts' }, ME)).toBe(true);
    expect(
      shouldApply('workouts', { ...w, owner_device_id: ME }, { ...pending, table: 'workouts' }, ME),
    ).toBe(false);
  });
});
