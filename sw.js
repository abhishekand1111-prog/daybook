const CACHE = 'daybook-v37';
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png', './icons/mark.png'];

self.addEventListener('install', function(event){
  event.waitUntil(caches.open(CACHE).then(function(cache){ return cache.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

// Tapping a reminder or focus notification brings Growth Loop to the front (or opens it).
self.addEventListener('notificationclick', function(event){
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({type:'window', includeUncontrolled:true}).then(function(list){
      for (var i = 0; i < list.length; i++){ if ('focus' in list[i]) return list[i].focus(); }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});

self.addEventListener('fetch', function(event){
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  // Firestore / auth traffic goes straight to the network.
  if (/googleapis\.com|firebaseio\.com|identitytoolkit/.test(url.hostname)) return;
  var isPage = event.request.mode === 'navigate' || event.request.destination === 'document';
  if (isPage){
    // The page always comes fresh from the server (skipping the 10-minute HTTP cache), so a new version
    // shows on the next open; offline it falls back to the cached copy.
    event.respondWith(
      fetch(event.request.url, {cache:'no-cache', credentials:'same-origin'}).then(function(res){
        if (res && res.ok){ var copy = res.clone(); caches.open(CACHE).then(function(c){ c.put(event.request, copy); }); }
        return res;
      }).catch(function(){ return caches.match(event.request).then(function(r){ return r || caches.match('./index.html'); }); })
    );
    return;
  }
  // Shell files and the Firebase SDK (gstatic, opaque): cache, refresh in the background.
  event.respondWith(
    caches.match(event.request).then(function(cached){
      var net = fetch(event.request).then(function(res){
        if (res && (res.ok || res.type === 'opaque')){ var copy = res.clone(); caches.open(CACHE).then(function(c){ c.put(event.request, copy); }); }
        return res;
      }).catch(function(){ return cached; });
      return cached || net;
    })
  );
});
