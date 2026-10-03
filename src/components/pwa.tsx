"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { DownloadSimple, Export, PlusSquare, X } from "@phosphor-icons/react";

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Registra el service worker (solo en produccion: en desarrollo interfiere con la recarga en caliente).
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
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
        Instalar app en este celular
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
