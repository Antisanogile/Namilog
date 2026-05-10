// v37 colleague calendar test
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'later') return;
  const url = event.notification.data?.url || '/Namilog/?quickCheck=1';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('/Namilog/') && 'focus' in c) {
          c.focus();
          c.postMessage({ type: 'OPEN_QUICK_CHECK' });
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
