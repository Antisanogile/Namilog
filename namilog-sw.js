const VERSION = 'v40.6-report-culture-starter';
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'later') return;
  const targetUrl = event.notification.data?.url || '/Namilog/?quick=1';
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if (client.url.includes('/Namilog/') && 'focus' in client) {
        await client.focus();
        client.postMessage({ type: 'OPEN_QUICK_CHECK', version: VERSION });
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(targetUrl);
  })());
});
