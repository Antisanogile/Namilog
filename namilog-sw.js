self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'later') return;

  const fallbackUrl = new URL('/Namilog/?quickCheck=1', self.location.origin).href;
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : fallbackUrl;

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      try {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && clientUrl.pathname.startsWith('/Namilog/')) {
          await client.focus();
          client.postMessage({ type: 'OPEN_QUICK_CHECK' });
          return;
        }
      } catch (_) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({ type: 'OPEN_QUICK_CHECK' });
          return;
        }
      }
    }

    if (clients.openWindow) {
      await clients.openWindow(url);
    }
  })());
});
