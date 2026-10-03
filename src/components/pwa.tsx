"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowCircleUp, DownloadSimple, Export, PlusSquare, WifiSlash, X } from "@phosphor-icons/react";

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Registra el service worker (solo en produccion: en desarrollo interfiere con la recarga en caliente).
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}

/**
 * Vigila el servidor y las versiones publicadas (la PWA instalada no se recarga sola):
 * - Servidor caido: muestra "Recargar" y reintenta solo cada pocos segundos; al volver quita el aviso
 *   (y si se estaba en la pantalla "Sin conexion", recarga para mostrar la pagina real).
 * - Version nueva: recarga sola, salvo en "Nueva venta" donde solo avisa para no perder el carrito.
 * Revisa al volver a la app, al recuperar la red y cada minuto mientras esta visible.
 */
export function VigilanteApp() {
  const [estado, setEstado] = useState<"ok" | "caido" | "nueva">("ok");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fallos = 0;
    let activo = true;
    const enVenta = () => location.pathname.startsWith("/ventas/nueva");
    const enPantallaOffline = () => !!document.querySelector("[data-sin-conexion]");

    async function revisar() {
      clearTimeout(timer);
      if (!activo || document.hidden) return; // se retoma con visibilitychange
      let version: string | undefined;
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        // 502-504: Caddy/Tailscale responden pero Next no esta corriendo
        if (r.status >= 500) throw new Error(String(r.status));
        version = (await r.json()).version;
      } catch {
        fallos++;
        setEstado("caido");
        timer = setTimeout(revisar, Math.min(2000 * fallos, 10000));
        return;
      }
      fallos = 0;
      if (enPantallaOffline()) return location.reload();
      if (version && version !== process.env.VERSION_APP) {
        if (!enVenta()) return location.reload();
        setEstado("nueva");
      } else setEstado("ok");
      timer = setTimeout(revisar, 60_000);
    }

    const alVolver = () => {
      if (document.visibilityState === "visible") revisar();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("online", revisar);
    revisar();
    return () => {
      activo = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("online", revisar);
    };
  }, []);

  if (estado === "ok") return null;
  const caido = estado === "caido";
  return (
    <div
      role="status"
      className="anim-aparecer fixed inset-x-0 top-[max(env(safe-area-inset-top),0.5rem)] z-[80] flex justify-center px-4 print:hidden"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-[#1c1c1e]/85 py-2 pl-4 pr-2 text-white shadow-xl backdrop-blur-xl backdrop-saturate-150">
        {caido ? <WifiSlash size={20} className="shrink-0" /> : <ArrowCircleUp size={20} className="shrink-0" />}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[13px] font-semibold">{caido ? "Sin conexión con el servidor" : "Hay una versión nueva"}</p>
          <p className="text-[11px] text-white/70">{caido ? "Reintentando automáticamente…" : "Actualice al terminar esta venta"}</p>
        </div>
        <button onClick={() => location.reload()} className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold text-black active:opacity-70">
          {caido ? "Recargar" : "Actualizar"}
        </button>
      </div>
    </div>
  );
}

// Estado de conexion del dispositivo.
function suscribirConexion(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
export function useEnLinea() {
  return useSyncExternalStore(suscribirConexion, () => navigator.onLine, () => true);
}

// beforeinstallprompt llega una sola vez; se guarda a nivel de modulo para cualquier pantalla.
let eventoGuardado: EventoInstalar | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    eventoGuardado = e as EventoInstalar;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    eventoGuardado = null;
    avisar();
  });
}
function suscribirInstalar(cb: () => void) {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}
const sinSuscripcion = () => () => {};
const esStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Boton para instalar la app (Android/Chrome) o instrucciones (iPhone/Safari). */
export function InstalarApp({ variante = "claro" }: { variante?: "claro" | "oscuro" }) {
  const evento = useSyncExternalStore(suscribirInstalar, () => eventoGuardado, () => null);
  const instalada = useSyncExternalStore(sinSuscripcion, esStandalone, () => true);
  const ios = useSyncExternalStore(sinSuscripcion, esIOS, () => false);
  const [verAyuda, setVerAyuda] = useState(false);

  if (instalada || (!evento && !ios)) return null;

  const estilo =
    variante === "claro"
      ? "border-white/40 bg-white/15 text-white hover:bg-white/25"
      : "border-marca/30 bg-marca/10 text-marca-oscuro hover:bg-marca/15";

  return (
    <>
      <button
        type="button"
        className={`btn w-full border text-sm ${estilo}`}
        onClick={async () => {
          if (!evento) return setVerAyuda(true);
          await evento.prompt();
          await evento.userChoice;
          eventoGuardado = null;
          avisar();
        }}
      >
        <DownloadSimple size={20} weight="bold" />
        Instalar la app en este equipo
      </button>
      {verAyuda && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={() => setVerAyuda(false)}>
          <div className="pb-seguro w-full max-w-sm rounded-2xl bg-white p-5 text-texto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Instalar en iPhone</h2>
              <button onClick={() => setVerAyuda(false)} aria-label="Cerrar" className="text-gris">
                <X size={22} />
              </button>
            </div>
            <ol className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <Export size={24} className="shrink-0 text-marca" /> Toque el botón Compartir de Safari.
              </li>
              <li className="flex items-center gap-3">
                <PlusSquare size={24} className="shrink-0 text-marca" /> Elija &quot;Agregar a pantalla de inicio&quot;.
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
