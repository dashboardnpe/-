// Service worker do Painel NPE Vale
// Ao alterar qualquer arquivo do app, aumente a versão abaixo para forçar a atualização.
const VERSAO = 'painel-npe-v9';
const CACHE_APP = VERSAO + '-app';
const CACHE_EXT = VERSAO + '-ext';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './dados.json',
  './imagens/npelogob.png',
  './imagens/valelogob.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

const EXTERNOS = [
  'https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.0/echarts.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const app = await caches.open(CACHE_APP);
    await app.addAll(APP_SHELL);
    const ext = await caches.open(CACHE_EXT);
    // Bibliotecas externas: se falhar offline na instalação, são guardadas depois no primeiro uso.
    await Promise.all(EXTERNOS.map(u => ext.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => !n.startsWith(VERSAO)).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Rede primeiro, com cache de reserva: usado para dados.json e páginas (dados sempre atualizados quando online).
async function redePrimeiro(req) {
  const cache = await caches.open(CACHE_APP);
  try {
    const resp = await fetch(req, { cache: 'no-cache' });
    if (resp && resp.ok) cache.put(req, resp.clone());
    return resp;
  } catch (_) {
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html'));
  }
}

// Cache primeiro: usado para bibliotecas, fontes e imagens (não mudam).
async function cachePrimeiro(req, nomeCache) {
  const cache = await caches.open(nomeCache);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const resp = await fetch(req);
    if (resp && (resp.ok || resp.type === 'opaque')) cache.put(req, resp.clone());
    return resp;
  } catch (_) {
    return hit || Response.error();
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    if (req.mode === 'navigate' || url.pathname.endsWith('/dados.json') || url.pathname.endsWith('/index.html')) {
      e.respondWith(redePrimeiro(req));
    } else {
      e.respondWith(cachePrimeiro(req, CACHE_APP));
    }
    return;
  }

  if (['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) {
    e.respondWith(cachePrimeiro(req, CACHE_EXT));
  }
});
