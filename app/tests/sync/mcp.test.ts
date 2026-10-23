import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { saveRow } from '@/data/repositories/base';
import { supabase } from '@/data/supabase';
import { pull, push } from '@/data/sync/engine';
import type { RoutineRow } from '@/domain/types';
import { callTool, oauthToken } from '../mcp/harness';
import { type Account, outboxCount, resetLocalDevice, setupAccount } from './harness';

// Connecteur Claude (docs/spec-mcp.md §10) : l'Edge Function écrit comme un appareil virtuel, le moteur de l'app la voit
// au pull sans écraser une modification locale plus récente.

let account: Account;
let token: string;

beforeAll(async () => {
  account = await setupAccount();
  token = (
    await oauthToken({
      userId: account.userId,
      email: '',
      password: '',
      app: supabase,
      appToken: account.accessToken,
    })
  ).accessToken;
});
beforeEach(resetLocalDevice);

describe('écritures de Claude et synchronisation', () => {
  it('une routine créée par Claude arrive dans Dexie au pull', async () => {
    const r = await callTool(token, 'create_routine', {
      name: 'Routine de Claude',
      exercises: [{ exercise: 'Squat (barre)', sets: 3 }],
    });
    expect(r.isError).toBeFalsy();
    await pull();
    const local = await db.routines.get(r.data.id as string);
    expect(local?.doc.name).toBe('Routine de Claude');
    expect(local?.client_device_id).not.toBe(account.userId);
  });

  it("une modification locale plus récente dans l'outbox n'est pas écrasée", async () => {
    const r = await callTool(token, 'create_routine', {
      name: 'Avant',
      exercises: [{ exercise: 'Squat (barre)', sets: 3 }],
    });
    await pull();
    const row = (await db.routines.get(r.data.id as string)) as RoutineRow;
    const realNow = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(realNow + 60_000);
    await saveRow('routines', { ...row, doc: { ...row.doc, name: 'Téléphone' } });
    clock.mockRestore();

    const upd = await callTool(token, 'update_routine', { id: r.data.id, name: 'Claude' });
    expect(upd.isError).toBeFalsy();

    await pull();
    expect((await db.routines.get(row.id))?.doc.name).toBe('Téléphone');
    await push();
    expect(await outboxCount()).toBe(0);
    const { data } = await supabase.from('routines').select('doc').eq('id', row.id).single();
    expect((data!.doc as { name: string }).name).toBe('Téléphone');
  });
});
