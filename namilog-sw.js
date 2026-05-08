self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'later') return;

  const url = event.notification.data?.url || '/Namilog/?quickCheck=1';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);
          const targetUrl = new URL(url, self.location.origin);
          if (clientUrl.origin === targetUrl.origin && clientUrl.pathname.startsWith('/Namilog/')) {
            client.focus();
            client.postMessage({ type: 'OPEN_QUICK_CHECK' });
            return;
          }
        } catch (_) {
          if ('focus' in client) {
            client.focus();
            client.postMessage({ type: 'OPEN_QUICK_CHECK' });
            return;
          }
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
