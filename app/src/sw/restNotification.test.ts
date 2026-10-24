import { describe, expect, it, vi } from 'vitest';
import {
  type NotificationRegistration,
  parseRestPush,
  restNotificationOptions,
  showRestNotification,
} from './restNotification';

// Cette méthode permet de simuler l'enregistrement du service worker lorsque des notifications sont déjà affichées.
function fakeRegistration(tags: string[], failGet = false) {
  const shown: { tag: string; close: () => void; closed: boolean }[] = tags.map((tag) => {
    const n = { tag, closed: false, close: () => (n.closed = true) };
    return n;
  });
  const reg: NotificationRegistration = {
    getNotifications: vi.fn(async () => {
      if (failGet) throw new Error('indisponible');
      return shown.filter((n) => !n.closed);
    }),
    showNotification: vi.fn(async (_title: string, options?: NotificationOptions) => {
      const n = { tag: options?.tag ?? '', closed: false, close: () => (n.closed = true) };
      shown.push(n);
    }),
  };
  return { reg, shown };
}

describe('parseRestPush (§7.7)', () => {
  it('lit le titre et le texte envoyés par send-push', () => {
    const data = { json: () => ({ title: 'Repos terminé', body: 'Squat, série 2' }), text: () => '' };
    expect(parseRestPush(data)).toEqual({ title: 'Repos terminé', body: 'Squat, série 2' });
  });

  it('retombe sur « Overload » et le texte brut quand le contenu n’est pas du JSON', () => {
    const data = {
      json: () => {
        throw new SyntaxError('pas du JSON');
      },
      text: () => 'Repos terminé',
    };
    expect(parseRestPush(data)).toEqual({ title: 'Overload', body: 'Repos terminé' });
  });

  it('affiche « Overload » sans texte pour un push vide ou incomplet', () => {
    expect(parseRestPush(null)).toEqual({ title: 'Overload', body: '' });
    expect(parseRestPush({ json: () => ({}), text: () => '' })).toEqual({ title: 'Overload', body: '' });
  });
});

describe('restNotificationOptions (#44)', () => {
  it('donne un tag différent à chaque repos pour que chaque notification sonne', () => {
    const a = restNotificationOptions('Série 1', 'a1');
    const b = restNotificationOptions('Série 2', 'b2');
    expect(a.tag).toBe('rest-a1');
    expect(b.tag).not.toBe(a.tag);
    expect(a.silent).toBeUndefined();
    expect(a.body).toBe('Série 1');
  });
});

describe('showRestNotification (#44)', () => {
  it('ferme les notifications de repos précédentes puis affiche la nouvelle', async () => {
    const { reg, shown } = fakeRegistration(['rest', 'rest-a1', 'autre']);
    await showRestNotification(reg, { title: 'Repos terminé', body: 'Squat' }, 'b2');

    expect(reg.showNotification).toHaveBeenCalledWith(
      'Repos terminé',
      expect.objectContaining({ tag: 'rest-b2', body: 'Squat' }),
    );
    expect(shown.filter((n) => !n.closed).map((n) => n.tag)).toEqual(['autre', 'rest-b2']);
  });

  it('affiche le titre et le texte reçus tels quels, sans mention ajoutée (#27)', async () => {
    const { reg } = fakeRegistration([]);
    await showRestNotification(reg, { title: 'Repos terminé', body: 'Squat, série 2' }, 'c3');
    const [title, options] = vi.mocked(reg.showNotification).mock.calls[0] ?? [];
    expect(title).toBe('Repos terminé');
    expect(options?.body).toBe('Squat, série 2');
  });

  it('ne ferme pas une notification dont le tag commence seulement par « rest »', async () => {
    const { reg, shown } = fakeRegistration(['restaurant']);
    await showRestNotification(reg, { title: 'Repos terminé', body: '' }, 'd4');
    expect(shown[0]?.closed).toBe(false);
  });

  it('affiche quand même la notification si la liste des précédentes est indisponible', async () => {
    const { reg } = fakeRegistration([], true);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await showRestNotification(reg, { title: 'Repos terminé', body: '' }, 'e5');
    expect(reg.showNotification).toHaveBeenCalledOnce();
  });
});
