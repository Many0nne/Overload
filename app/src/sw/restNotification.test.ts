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

  it('n’ajoute aucune mention au titre ni au texte (#27)', () => {
    const data = { json: () => ({ title: 'Repos terminé', body: 'Squat' }), text: () => '' };
    const { title, body } = parseRestPush(data);
    expect(`${title} ${body}`).not.toMatch(/from|overload/i);
  });
});

describe('restNotificationOptions (#44)', () => {
  it('donne un tag différent à chaque repos pour que chaque notification sonne', () => {
    const a = restNotificationOptions('Série 1', 1000);
    const b = restNotificationOptions('Série 2', 2000);
    expect(a.tag).toBe('rest-1000');
    expect(b.tag).not.toBe(a.tag);
    expect(a.silent).toBeUndefined();
    expect(a.body).toBe('Série 1');
  });
});

describe('showRestNotification (#44)', () => {
  it('ferme les notifications de repos précédentes puis affiche la nouvelle', async () => {
    const { reg, shown } = fakeRegistration(['rest', 'rest-1000', 'autre']);
    await showRestNotification(reg, { title: 'Repos terminé', body: 'Squat' }, 2000);

    expect(reg.showNotification).toHaveBeenCalledWith(
      'Repos terminé',
      expect.objectContaining({ tag: 'rest-2000', body: 'Squat' }),
    );
    expect(shown.filter((n) => !n.closed).map((n) => n.tag)).toEqual(['autre', 'rest-2000']);
  });

  it('ne ferme pas une notification dont le tag commence seulement par « rest »', async () => {
    const { reg, shown } = fakeRegistration(['restaurant']);
    await showRestNotification(reg, { title: 'Repos terminé', body: '' }, 1);
    expect(shown[0]?.closed).toBe(false);
  });

  it('affiche quand même la notification si la liste des précédentes est indisponible', async () => {
    const { reg } = fakeRegistration([], true);
    await showRestNotification(reg, { title: 'Repos terminé', body: '' }, 1);
    expect(reg.showNotification).toHaveBeenCalledOnce();
  });
});
