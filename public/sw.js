// Service worker de InventX Ventas.
// - Recursos estaticos (_next/static, iconos): cache primero.
// - Paginas: siempre red; sin conexion muestra /offline.
// - API y acciones: nunca se cachean (datos de ventas en vivo).
const VERSION = "inventx-v2";
const ESTATICO = `${VERSION}-estatico`;
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(ESTATICO)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copia = res.clone();
              caches.open(ESTATICO).then((c) => c.put(req, copia));
            }
            return res;
          })
      )
    );
    return;
  }

  if (req.mode === "navigate") {
    // Sin red, o 502-504 de Caddy/Tailscale con Next detenido: pantalla "Sin conexion" (se recarga sola al volver).
    const sinConexion = (res) => caches.match("/offline").then((o) => o || res);
    event.respondWith(
      fetch(req)
        .then((res) => (res.status >= 502 && res.status <= 504 ? sinConexion(res) : res))
        .catch(() => sinConexion(Response.error()))
    );
  }
});
