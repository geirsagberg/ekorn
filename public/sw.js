const APP_SHELL_CACHE = 'ekorn-app-shell-v2'
const STATIC_ASSET_CACHE = 'ekorn-static-v2'
const APP_SHELL_URLS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/logo512-maskable.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName !== APP_SHELL_CACHE &&
                cacheName !== STATIC_ASSET_CACHE,
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const requestUrl = new URL(request.url)

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request))
    return
  }

  if (
    ['font', 'image', 'manifest', 'script', 'style'].includes(
      request.destination,
    )
  ) {
    event.respondWith(handleStaticAssetRequest(request))
  }
})

async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request)
    const cache = await caches.open(APP_SHELL_CACHE)
    cache.put('/', response.clone())
    return response
  } catch {
    return (await caches.match(request)) || (await caches.match('/'))
  }
}

async function handleStaticAssetRequest(request) {
  const cachedResponse = await caches.match(request)

  if (cachedResponse) {
    void refreshStaticAsset(request)
    return cachedResponse
  }

  return refreshStaticAsset(request)
}

async function refreshStaticAsset(request) {
  const response = await fetch(request)
  const cache = await caches.open(STATIC_ASSET_CACHE)
  cache.put(request, response.clone())
  return response
}
