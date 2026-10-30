import { createClient } from '@supabase/supabase-js';
import { v7 as uuidv7 } from 'uuid';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  callTool,
  catalogId,
  config,
  createAccount,
  type McpAccount,
  mcpUrl,
  oauthToken,
  registerClient,
  rpc,
} from './harness';

// Edge Function `mcp` contre Supabase local (docs/spec-mcp.md §10) : auth, droits, outils de lecture et d'écriture.

const DEVICE = '22222222-2222-7222-8222-222222222222';

describe('découverte et authentification', () => {
  it('répond 401 + WWW-Authenticate sans jeton, et sert les métadonnées de ressource', async () => {
    const res = await rpc(undefined, 'initialize');
    expect(res.status).toBe(401);
    const header = res.headers.get('www-authenticate') ?? '';
    expect(header).toContain(`resource_metadata="${mcpUrl()}/.well-known/oauth-protected-resource"`);
    const meta = await (await fetch(`${mcpUrl()}/.well-known/oauth-protected-resource`)).json();
    expect(meta.resource).toBe(mcpUrl());
    expect(meta.authorization_servers[0]).toMatch(/\/auth\/v1$/);
  });

  it("refuse un jeton de session de l'app (sans client_id)", async () => {
    const account = await createAccount();
    expect((await rpc(account.appToken, 'tools/list')).status).toBe(401);
  });

  it('refuse une connexion déconnectée, puis la rétablit à la nouvelle approbation', async () => {
    const account = await createAccount();
    const { clientId, accessToken } = await oauthToken(account);
    expect((await rpc(accessToken, 'tools/list')).status).toBe(200);
    // « Déconnecter » (Paramètres › Claude) : révocation du grant Supabase Auth puis de la connexion.
    await account.app.auth.oauth.revokeGrant({ clientId });
    await account.app.rpc('revoke_mcp_connection', { p_client_id: clientId });
    expect((await rpc(accessToken, 'tools/list')).status).toBe(401);
    const again = await oauthToken(account, { clientId });
    expect((await rpc(again.accessToken, 'tools/list')).status).toBe(200);
  });

  it('applique lecture seule et déconnexion en base, même sans passer par le connecteur', async () => {
    const account = await createAccount();
    const { url, anonKey } = config();
    const { clientId, accessToken, refreshToken } = await oauthToken(account, { canWrite: false });
    const direct = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect((await direct.from('profiles').select('id')).data).toHaveLength(1);
    const push = await direct.rpc('sync_push', { p_device_id: DEVICE, p_changes: [] });
    expect(push.error?.message).toBe('connection_read_only');
    const upgrade = await direct.rpc('upsert_mcp_connection', {
      p_client_id: clientId,
      p_client_name: 'Claude',
      p_can_write: true,
    });
    expect(upgrade.error?.message).toBe('oauth_forbidden');
    const del = await fetch(`${url}/functions/v1/delete-account`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, apikey: anonKey },
    });
    expect(del.status).toBe(403);

    // Cette méthode permet de renouveler le jeton OAuth comme le fait Claude à son expiration.
    const refresh = (token: string) =>
      fetch(`${url}/auth/v1/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token, client_id: clientId }),
      });
    const renewed = await refresh(refreshToken);
    expect(renewed.ok).toBe(true);
    const next = ((await renewed.json()) as { refresh_token: string }).refresh_token;

    // « Déconnecter » côté base seulement : lectures refusées et refresh token invalidé.
    await account.app.rpc('revoke_mcp_connection', { p_client_id: clientId });
    expect((await direct.from('profiles').select('id')).data).toHaveLength(0);
    expect((await refresh(next)).ok).toBe(false);
  });

  it('initialise avec les instructions et liste les outils annotés', async () => {
    const account = await createAccount();
    const { accessToken } = await oauthToken(account);
    const init = await (
      await rpc(accessToken, 'initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '1' },
      })
    ).json();
    expect(init.result.instructions).toContain('search_exercises');
    const list = await (await rpc(accessToken, 'tools/list')).json();
    const tools = list.result.tools as {
      name: string;
      annotations: { readOnlyHint: boolean; destructiveHint: boolean };
    }[];
    expect(tools).toHaveLength(19);
    expect(tools.find((t) => t.name === 'get_stats')?.annotations.readOnlyHint).toBe(true);
    expect(tools.find((t) => t.name === 'delete_workout')?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });
  });
});

describe('outils', () => {
  let account: McpAccount;
  let token: string;
  let squat: string;

  beforeAll(async () => {
    account = await createAccount({
      units: { weight: 'kg', length: 'cm', distance: 'km' },
      defaultRestS: 120,
    });
    token = (await oauthToken(account)).accessToken;
    squat = await catalogId(account.app, 'Squat (barre)');
  });

  it('lit le profil sans code d’invitation ni e-mail', async () => {
    const r = await callTool(token, 'get_profile');
    expect(r.isError).toBeFalsy();
    expect(r.data).toMatchObject({ name: 'Testeur', workoutCount: 0, defaultRestS: 120 });
    expect(JSON.stringify(r)).not.toMatch(/invite|@overload\.test|is_admin/);
  });

  it('cherche des exercices et signale un nom ambigu', async () => {
    const r = await callTool(token, 'search_exercises', { query: 'squat barre', limit: 5 });
    expect((r.data.items as { name: string }[])[0]?.name).toBe('Squat (barre)');
    const amb = await callTool(token, 'get_records', { exercise: 'squat' });
    expect(amb.isError).toBe(true);
    expect(amb.text).toContain('Précise le nom');
  });

  it('enregistre une séance passée, visible au sync_pull et dans les records', async () => {
    const first = await callTool(token, 'log_workout', {
      startedAt: '2026-09-01T18:00',
      exercises: [
        {
          exercise: 'Squat (barre)',
          sets: [
            { weight: 100, reps: 5 },
            { weight: 100, reps: 5 },
          ],
        },
      ],
    });
    expect(first.isError).toBeFalsy();
    const second = await callTool(token, 'log_workout', {
      startedAt: '2026-09-08T18:00',
      title: 'Jambes',
      durationS: 3000,
      exercises: [
        {
          exercise: squat,
          sets: [
            { kind: 'warmup', weight: 60, reps: 10 },
            { weight: 110, reps: 3 },
          ],
        },
      ],
    });
    expect(second.isError).toBeFalsy();
    expect(second.data).toMatchObject({ title: 'Jambes', durationS: 3000, volume: { v: 330, u: 'kg' } });
    expect(second.data.recordCount).toBeGreaterThan(0);

    const pull = await account.app.rpc('sync_pull', { p_cursors: {} });
    const pulled = (pull.data as { changes: { workouts: { id: string; client_device_id: string }[] } })
      .changes.workouts;
    expect(pulled.map((w) => w.id)).toContain(second.data.id);

    const hist = await callTool(token, 'get_exercise_history', { exercise: 'Squat (barre)' });
    const sessions = hist.data.sessions as { bestE1rm: { v: number } }[];
    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.bestE1rm.v).toBe(121);

    const recs = await callTool(token, 'get_records', { exercise: squat });
    expect(
      (recs.data.items as { criterion: string; value: string }[]).find((r) => r.criterion === 'max_weight')
        ?.value,
    ).toBe('110 kg');
    const list = await callTool(token, 'list_workouts', { limit: 1 });
    expect((list.data.workouts as unknown[]).length).toBe(1);
    expect(list.data.nextCursor).toBeTruthy();
    const page2 = await callTool(token, 'list_workouts', { limit: 1, cursor: list.data.nextCursor });
    expect((page2.data.workouts as { id: string }[])[0]?.id).toBe(first.data.id);

    const stats = await callTool(token, 'get_stats', { from: '2026-09-01', to: '2026-09-15' });
    expect(stats.data.totals).toMatchObject({ workouts: 2, sets: 3 });
  });

  it('refuse une série incomplète avec un message actionnable', async () => {
    const r = await callTool(token, 'log_workout', {
      startedAt: '2026-09-10',
      exercises: [{ exercise: squat, sets: [{ weight: 100 }] }],
    });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('reps');
  });

  it('crée et modifie une routine en gardant les ids des exercices conservés', async () => {
    const created = await callTool(token, 'create_routine', {
      name: 'Jambes A',
      exercises: [
        { exercise: squat, sets: 3, repRange: { min: 5, max: 8 } },
        { exercise: 'Gainage latéral', sets: [{ durationS: 45 }, { durationS: 45 }] },
      ],
    });
    expect(created.isError).toBeFalsy();
    const before = created.data.exercises as { exerciseId: string; restS: number; repRange?: unknown }[];
    expect(before[0]).toMatchObject({ restS: 120, repRange: { min: 5, max: 8 } });

    const bad = await callTool(token, 'create_routine', {
      name: 'X',
      exercises: [{ exercise: 'Gainage latéral', sets: 2, repRange: { min: 8, max: 12 } }],
    });
    expect(bad.isError).toBe(true);

    const updated = await callTool(token, 'update_routine', {
      id: 'Jambes A',
      exercises: [{ exercise: squat, sets: 4 }],
    });
    expect(updated.isError).toBeFalsy();
    const { data: row } = await account.app.from('routines').select('doc').eq('id', created.data.id).single();
    const doc = row!.doc as { exercises: { id: string; sets: unknown[]; repRange?: unknown }[] };
    expect(doc.exercises).toHaveLength(1);
    expect(doc.exercises[0]?.sets).toHaveLength(4);
    expect(doc.exercises[0]?.repRange).toEqual({ min: 5, max: 8 });

    const routines = await callTool(token, 'list_routines');
    expect((routines.data.routines as { name: string }[]).map((r) => r.name)).toContain('Jambes A');
  });

  it('relie deux exercices en superset (#77) et refuse un superset sans exercice suivant', async () => {
    const created = await callTool(token, 'create_routine', {
      name: 'Superset A',
      exercises: [
        { exercise: squat, sets: 3, superset: true },
        { exercise: 'Gainage latéral', sets: 2 },
      ],
    });
    expect(created.isError).toBeFalsy();
    const view = created.data.exercises as { superset?: boolean }[];
    expect(view.map((e) => e.superset)).toEqual([true, undefined]);
    const { data: row } = await account.app.from('routines').select('doc').eq('id', created.data.id).single();
    const doc = row!.doc as { schemaVersion: number; exercises: { groupId?: string }[] };
    expect(doc.schemaVersion).toBe(2);
    expect(doc.exercises[0]?.groupId).toBeTruthy();
    expect(doc.exercises[0]?.groupId).toBe(doc.exercises[1]?.groupId);

    const bad = await callTool(token, 'create_routine', {
      name: 'X',
      exercises: [{ exercise: squat, sets: 3, superset: true }],
    });
    expect(bad.isError).toBe(true);
  });

  it('complète la mesure du jour sans écraser, sauf overwrite', async () => {
    await callTool(token, 'add_body_measurement', { date: '2026-10-20', values: { weight: 81.4 } });
    const again = await callTool(token, 'add_body_measurement', {
      date: '2026-10-20',
      values: { weight: 82, waist: 84 },
    });
    expect(again.data.ignored).toEqual(['weight']);
    const forced = await callTool(token, 'add_body_measurement', {
      date: '2026-10-20',
      values: { weight: 82 },
      overwrite: true,
    });
    expect(forced.data.values).toMatchObject({ weight: { v: 82, u: 'kg' }, waist: { v: 84, u: 'cm' } });
    const list = await callTool(token, 'list_body_measurements', { keys: ['weight'] });
    expect(list.data.items).toEqual([
      { id: forced.data.id, date: '2026-10-20', values: { weight: { v: 82, u: 'kg' } } },
    ]);
  });

  it("fixe un objectif et des réglages, visibles par get_progression et l'app", async () => {
    const goal = await callTool(token, 'set_exercise_goal', { exercise: squat, weight: 140, reps: 1 });
    expect(goal.isError).toBeFalsy();
    await callTool(token, 'set_exercise_prefs', { exercise: squat, increment: 5 });
    const { data } = await account.app.from('exercise_prefs').select('doc').eq('exercise_id', squat).single();
    expect(data!.doc).toMatchObject({
      increment: { v: 5, u: 'kg' },
      longTermGoal: { reps: 1, weight: { v: 140, u: 'kg' } },
    });
    const prog = await callTool(token, 'get_progression', { exercise: squat });
    expect(prog.data.available).toBe(false);
  });

  it('journalise chaque écriture', async () => {
    const { data } = await account.app.from('mcp_audit').select('tool, sync_table, before, after');
    const tools = new Set((data ?? []).map((r) => r.tool));
    for (const t of [
      'log_workout',
      'create_routine',
      'update_routine',
      'add_body_measurement',
      'set_exercise_goal',
    ])
      expect(tools).toContain(t);
  });

  it('supprime logiquement une séance terminée', async () => {
    const w = await callTool(token, 'log_workout', {
      startedAt: '2026-10-01T07:00',
      exercises: [{ exercise: squat, sets: [{ weight: 50, reps: 10 }] }],
    });
    const del = await callTool(token, 'delete_workout', { id: w.data.id });
    expect(del.isError).toBeFalsy();
    const { data } = await account.app.from('workouts').select('deleted_at').eq('id', w.data.id).single();
    expect(data!.deleted_at).not.toBeNull();
    expect((await callTool(token, 'get_workout', { id: w.data.id })).isError).toBe(true);
  });
});

describe('droits et séances en cours', () => {
  it('refuse les écritures si la connexion est en lecture seule, mais autorise la lecture', async () => {
    const account = await createAccount();
    const { accessToken } = await oauthToken(account, { canWrite: false });
    expect((await callTool(accessToken, 'get_profile')).isError).toBeFalsy();
    const r = await callTool(accessToken, 'add_body_measurement', {
      date: '2026-10-20',
      values: { weight: 80 },
    });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('Les modifications sont désactivées');
  });

  it("refuse de modifier une séance en cours et l'emporte sur une écriture datée dans le futur", async () => {
    const account = await createAccount();
    const { accessToken } = await oauthToken(account);
    const squat = await catalogId(account.app, 'Squat (barre)');
    const id = uuidv7();
    const row = (status: string, cua: number) => ({
      id,
      user_id: account.userId,
      status,
      owner_device_id: DEVICE,
      routine_id: null,
      started_at: Date.now() - 3_600_000,
      exercise_ids: [squat],
      doc: { schemaVersion: 1, title: 'Live', exercises: [] },
      client_updated_at: cua,
      client_device_id: DEVICE,
      deleted_at: null,
    });
    await account.app.rpc('sync_push', {
      p_device_id: DEVICE,
      p_changes: [{ table: 'workouts', row: row('in_progress', Date.now()) }],
    });
    const live = await callTool(accessToken, 'update_workout', { id, title: 'Piraté' });
    expect(live.isError).toBe(true);
    expect(live.text).toContain('en cours');

    const future = Date.now() + 3_600_000;
    await account.app.rpc('sync_push', {
      p_device_id: DEVICE,
      p_changes: [{ table: 'workouts', row: row('completed', future) }],
    });
    const upd = await callTool(accessToken, 'update_workout', { id, title: 'Renommée' });
    expect(upd.isError).toBeFalsy();
    const { data } = await account.app
      .from('workouts')
      .select('doc, client_updated_at')
      .eq('id', id)
      .single();
    expect(data!.doc.title).toBe('Renommée');
    expect(data!.client_updated_at).toBe(future + 1);
  });

  // Cette méthode permet de lire le RPE de la première série d'une séance renvoyée par get_workout.
  const firstRpe = (data: Record<string, unknown>) =>
    (data.exercises as { sets: { rpe?: number }[] }[])[0]?.sets[0]?.rpe;

  it('masque le RPE et l’objectif à long terme des exercices qui les désactivent (#124)', async () => {
    const account = await createAccount();
    const { accessToken } = await oauthToken(account);
    const squat = await catalogId(account.app, 'Squat (barre)');
    const logged = await callTool(accessToken, 'log_workout', {
      startedAt: '2026-09-01T18:00',
      exercises: [{ exercise: squat, sets: [{ weight: 100, reps: 5, rpe: 8 }] }],
    });
    await callTool(accessToken, 'set_exercise_goal', { exercise: squat, weight: 140, reps: 1 });
    const before = await callTool(accessToken, 'get_workout', { id: logged.data.id });
    expect(firstRpe(before.data)).toBe(8);
    expect((await callTool(accessToken, 'get_profile', {})).data.longTermGoals).toBe(1);

    const { data: prefs } = await account.app
      .from('exercise_prefs')
      .select('*')
      .eq('exercise_id', squat)
      .single();
    await account.app.rpc('sync_push', {
      p_device_id: DEVICE,
      p_changes: [
        {
          table: 'exercise_prefs',
          row: {
            ...prefs,
            doc: { ...prefs!.doc, rpe: false, progression: false },
            client_updated_at: Date.now() + 1000,
            client_device_id: DEVICE,
          },
        },
      ],
    });
    const after = await callTool(accessToken, 'get_workout', { id: logged.data.id });
    expect(firstRpe(after.data)).toBeUndefined();
    expect(after.text).not.toContain('RPE');
    expect((await callTool(accessToken, 'get_profile', {})).data.longTermGoals).toBe(0);
  });

  it('accepte un client enregistré par Claude Code (boucle locale, port exact)', async () => {
    const clientId = await registerClient('Claude Code', 'http://localhost:33418/callback');
    expect(clientId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
