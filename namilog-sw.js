self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'later') return;
  const url = (event.notification.data && event.notification.data.url) || '/Namilog/?quickCheck=1';
  // v24-completion-review
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if (client.url.includes('/Namilog/') && 'focus' in client) {
        client.focus();
        client.postMessage({ type: 'OPEN_QUICK_CHECK' });
        return;
      }
    }
    if (clients.openWindow) return clients.openWindow(url);
  })());
});
