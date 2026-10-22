/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

// Photos de séance : l'URL signée change à chaque demande, on met donc l'image en cache par chemin de stockage
// (paramètre p= ajouté par PhotoView), en CacheFirst : une photo n'est jamais modifiée sous le même chemin (§12).
const PHOTO_CACHE = 'photos-v1';
registerRoute(
  ({ url, request }) =>
    request.destination === 'image' &&
    url.pathname.includes('/storage/v1/object/sign/') &&
    url.searchParams.has('p'),
  new CacheFirst({
    cacheName: PHOTO_CACHE,
    plugins: [
      {
        // Cette méthode permet d'indexer le cache par chemin de stockage plutôt que par URL signée.
        cacheKeyWillBeUsed: async ({ request }) => {
          const path = new URL(request.url).searchParams.get('p') ?? request.url;
          return `${self.location.origin}/__photo/${encodeURIComponent(path)}`;
        },
        // Cette méthode permet de ne garder en cache que les réponses réussies (pas d'URL expirée en 400).
        cacheWillUpdate: async ({ response }) => (response.ok ? response : null),
      },
    ],
  }),
);

// Cette méthode permet d'activer la nouvelle version lorsque l'app le demande (fin de séance ou relance).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// Cette méthode permet d'afficher la notification de fin de repos lorsqu'un push arrive (iOS exige un affichage).
self.addEventListener('push', (event) => {
  const data = (() => {
    try {
      return event.data?.json() as { title?: string; body?: string };
    } catch {
      return { title: 'Overload', body: event.data?.text() };
    }
  })();
  event.waitUntil(
    self.registration.showNotification(data?.title ?? 'Overload', {
      body: data?.body ?? '',
      tag: 'rest',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    }),
  );
});

// Cette méthode permet de ramener l'utilisateur dans l'app lorsqu'il touche la notification.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = all[0];
      if (client) return client.focus();
      return self.clients.openWindow('/');
    })(),
  );
});
