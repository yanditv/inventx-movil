"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, CircleNotch, Printer, WarningCircle } from "@phosphor-icons/react";

type Estado = {
  idCola: number;
  estado: "PENDIENTE" | "IMPRIMIENDO" | "IMPRESO" | "ERROR";
  mensaje: string | null;
  impresora: string | null;
};

// Si la caja no toma el pedido en este tiempo, probablemente InventX escritorio esta cerrado.
const ESPERA_MAXIMA_MS = 45_000;

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "No se pudo enviar a imprimir");
  return data as T;
}

/**
 * Envia el ticket a la cola de impresion de la caja y muestra el avance.
 * Si recibe idColaInicial (impresion automatica al guardar), solo sigue ese pedido.
 */
export default function BotonImprimir({
  idVenta,
  idColaInicial,
  caja,
  className = "",
}: {
  idVenta: number;
  idColaInicial?: number | null;
  caja: string;
  className?: string;
}) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [siguiendo, setSiguiendo] = useState<number | null>(idColaInicial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [agotado, setAgotado] = useState(false);
  const inicio = useRef(0);

  useEffect(() => {
    if (!siguiendo) return;
    let vigente = true;
    let timer: ReturnType<typeof setTimeout>;
    inicio.current = Date.now();
    const consultar = async () => {
      try {
        const e = await pedir<Estado>(`/api/impresion/${siguiendo}`);
        if (!vigente) return;
        setEstado(e);
        if (e.estado === "IMPRESO" || e.estado === "ERROR") return setSiguiendo(null);
        if (e.estado === "PENDIENTE" && Date.now() - inicio.current > ESPERA_MAXIMA_MS) {
          setAgotado(true);
          return setSiguiendo(null);
        }
      } catch {
        // Fallo de red momentaneo: se reintenta en el siguiente ciclo.
      }
      if (vigente) timer = setTimeout(consultar, 1500);
    };
    consultar();
    return () => {
      vigente = false;
      clearTimeout(timer);
    };
  }, [siguiendo]);

  async function imprimir() {
    setError(null);
    setAgotado(false);
    setEstado(null);
    try {
      const e = await pedir<Estado>(`/api/ventas/${idVenta}/imprimir`, { method: "POST" });
      setEstado(e);
      setSiguiendo(e.idCola);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const enCurso = siguiendo !== null;
  const texto = enCurso
    ? estado?.estado === "IMPRIMIENDO"
      ? "Imprimiendo en la caja..."
      : "Enviando a la caja..."
    : estado?.estado === "IMPRESO"
      ? "Imprimir otra vez"
      : "Imprimir ticket";

  return (
    <div className={`space-y-2 ${className}`}>
      <button className="btn-secundario w-full border-marca/40 text-marca-oscuro" onClick={imprimir} disabled={enCurso}>
        {enCurso ? <CircleNotch size={20} className="animate-spin" /> : <Printer size={20} weight="duotone" />}
        {texto}
      </button>
      {estado?.estado === "IMPRESO" && !enCurso && (
        <p className="anim-aparecer flex items-center gap-2 rounded-md bg-exito/10 px-3 py-2 text-sm text-exito">
          <CheckCircle size={18} weight="fill" className="shrink-0" />
          Ticket impreso{estado.impresora ? ` en ${estado.impresora}` : ""}.
        </p>
      )}
      {(estado?.estado === "ERROR" || error) && !enCurso && (
        <p className="anim-aparecer flex items-start gap-2 rounded-md bg-peligro/8 px-3 py-2 text-sm text-peligro">
          <WarningCircle size={18} weight="fill" className="mt-px shrink-0" />
          {error ?? estado?.mensaje ?? "No se pudo imprimir"}
        </p>
      )}
      {agotado && (
        <p className="anim-aparecer flex items-start gap-2 rounded-md bg-aviso/10 px-3 py-2 text-sm text-[#b45309]">
          <WarningCircle size={18} weight="fill" className="mt-px shrink-0" />
          {caja} todavía no recibe el pedido. Verifique que InventX esté abierto en esa caja; se imprimirá en cuanto se abra
          (hasta 30 minutos).
        </p>
      )}
    </div>
  );
}
