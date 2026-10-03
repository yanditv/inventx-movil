"use client";

import { useSyncExternalStore } from "react";

// Preferencias guardadas en este celular (no en el servidor): cada dispositivo decide,
// por ejemplo imprimir automaticamente cuando esta en el local y manualmente fuera de el.

const CLAVE_IMPRIMIR_AUTO = "inventx:imprimir-auto";
const EVENTO = "inventx:preferencias";

function leer(clave: string) {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function suscribir(cb: () => void) {
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useImprimirAuto() {
  return useSyncExternalStore(suscribir, () => leer(CLAVE_IMPRIMIR_AUTO) === "1", () => false);
}

export function setImprimirAuto(valor: boolean) {
  try {
    localStorage.setItem(CLAVE_IMPRIMIR_AUTO, valor ? "1" : "0");
  } catch {}
  window.dispatchEvent(new Event(EVENTO));
}
