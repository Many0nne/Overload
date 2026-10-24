// Notification de fin de repos affichée par le service worker (§7.7).
// Chaque repos reçoit un tag unique : une notification qui en remplace une autre de même tag ne sonne pas
// (spécification Notifications), et `renotify` n'est pas pris en charge par Safari/iOS. Les précédentes sont fermées
// pour n'en garder qu'une dans le centre de notifications.

export const REST_TAG_PREFIX = 'rest';

export interface RestPayload {
  title: string;
  body: string;
}

/** Sous-ensemble de ServiceWorkerRegistration utilisé ici (remplaçable dans les tests). */
export interface NotificationRegistration {
  getNotifications(): Promise<Pick<Notification, 'tag' | 'close'>[]>;
  showNotification(title: string, options?: NotificationOptions): Promise<void>;
}

// Cette méthode permet de lire le contenu d'un push lorsqu'il arrive, en JSON ou à défaut en texte brut.
export function parseRestPush(data: Pick<PushMessageData, 'json' | 'text'> | null): RestPayload {
  if (!data) return { title: 'Overload', body: '' };
  try {
    const parsed = data.json() as { title?: unknown; body?: unknown } | null;
    return {
      title: typeof parsed?.title === 'string' && parsed.title ? parsed.title : 'Overload',
      body: typeof parsed?.body === 'string' ? parsed.body : '',
    };
  } catch {
    return { title: 'Overload', body: data.text() };
  }
}

// Cette méthode permet de construire les options de la notification lorsqu'un repos se termine à l'instant `now`.
export function restNotificationOptions(body: string, now: number): NotificationOptions {
  return {
    body,
    tag: `${REST_TAG_PREFIX}-${now}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  };
}

// Cette méthode permet d'afficher la notification de fin de repos lorsqu'un push arrive, après avoir fermé les précédentes.
// Une erreur à la fermeture n'empêche jamais l'affichage : iOS révoque l'abonnement des push sans notification.
export async function showRestNotification(
  registration: NotificationRegistration,
  payload: RestPayload,
  now: number,
): Promise<void> {
  try {
    const previous = await registration.getNotifications();
    for (const n of previous) {
      if (n.tag === REST_TAG_PREFIX || n.tag.startsWith(`${REST_TAG_PREFIX}-`)) n.close();
    }
  } catch {
    // Fermeture impossible : la nouvelle notification s'ajoute simplement aux anciennes.
  }
  await registration.showNotification(payload.title, restNotificationOptions(payload.body, now));
}
