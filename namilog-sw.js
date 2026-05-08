self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/Namilog/?quickCheck=1';
  if (event.action === 'later') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'OPEN_QUICK_CHECK' });
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
