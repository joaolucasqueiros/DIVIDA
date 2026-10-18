// Financial responses and authenticated pages are never cached.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => new Response('<html lang="pt-BR"><meta charset="utf-8"><p>Você está sem conexão. Reconecte para acessar suas finanças com segurança.</p></html>', {headers:{'Content-Type':'text/html; charset=utf-8'}})));
});
