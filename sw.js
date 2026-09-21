/* ==========================================================================
   Cache hors ligne pour 70 → 76.

   Stratégie volontairement différente selon le type de requête :

   · La PAGE (navigation) est servie RÉSEAU D'ABORD. C'est ce qui garantit
     qu'un nouveau déploiement arrive tout de suite. Sans réseau, on
     retombe sur le cache : le hors ligne reste intact.
   · Le RESTE (polices, etc.) est servi cache d'abord, pour la vitesse.

   La version précédente était cache-d'abord pour tout, ce qui bloquait
   les mises à jour pendant un ou deux lancements. Corrigé ici.
   ========================================================================== */
var CACHE = 'luka-gym-v7';

self.addEventListener('install', function(){
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE) return caches.delete(k);     /* purge l'ancien cache */
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* Permet à la page de forcer la bascule immédiatement */
self.addEventListener('message', function(e){
  if(e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  /* Open Food Facts : données vivantes, jamais mises en cache */
  if(req.url.indexOf('openfoodfacts.org') > -1) return;

  /* --- la page elle-même : réseau d'abord --- */
  if(req.mode === 'navigate' || (req.destination === 'document')){
    e.respondWith(
      fetch(req).then(function(res){
        if(res && res.status === 200){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){
        return caches.match(req).then(function(hit){
          return hit || caches.match('index.html') || caches.match('./');
        });
      })
    );
    return;
  }

  /* --- le reste : cache d'abord, rafraîchi en arrière-plan --- */
  e.respondWith(
    caches.match(req).then(function(hit){
      var net = fetch(req).then(function(res){
        if(res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return hit; });
      return hit || net;
    })
  );
});
