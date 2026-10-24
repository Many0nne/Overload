import 'fake-indexeddb/auto';
import { afterAll, describe, expect, it } from 'vitest';
import { DOC_VERSIONS } from '@/domain/schema';
import { OverloadDb } from './db';

describe('mise à niveau des documents locaux (#71)', () => {
  const name = 'overload-schema-test';
  afterAll(() => OverloadDb.delete(name));

  it('met au format de l’app les documents stockés, une seule fois par jeu de versions', async () => {
    const first = new OverloadDb(name);
    await first.workouts.put({ id: 'w', doc: { title: 'vieille', exercises: [] } } as never);
    await first.meta.delete('doc_versions');
    first.close();

    const db = new OverloadDb(name);
    expect((await db.workouts.get('w'))?.doc).toEqual({ schemaVersion: 1, title: 'vieille', exercises: [] });
    expect((await db.meta.get('doc_versions'))?.value).toEqual(DOC_VERSIONS);

    // Versions déjà appliquées : la table n'est plus parcourue à l'ouverture suivante.
    await db.workouts.put({ id: 'w2', doc: { title: 'sans version' } } as never);
    db.close();
    const again = new OverloadDb(name);
    expect((await again.workouts.get('w2'))?.doc).toEqual({ title: 'sans version' });
    again.close();
  });
});
