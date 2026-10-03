"use client";

import { Printer } from "@phosphor-icons/react";
import { setImprimirAuto, useImprimirAuto } from "@/components/preferencias";

export default function InterruptorImpresion() {
  const activo = useImprimirAuto();
  return (
    <label htmlFor="imprimir-auto" className="flex cursor-pointer items-center gap-3 p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${activo ? "bg-marca/10 text-marca" : "bg-fondo text-gris"}`}>
        <Printer size={24} weight="duotone" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-texto">Imprimir automáticamente</span>
        <span className="block text-sm text-gris">
          {activo ? "Cada venta guardada se imprime en la caja." : "Usted decide cuándo imprimir con el botón “Imprimir ticket”."}
        </span>
      </span>
      <span className="relative inline-flex shrink-0 items-center">
        <input
          id="imprimir-auto"
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={activo}
          onChange={(e) => setImprimirAuto(e.target.checked)}
        />
        <span className="h-7 w-12 rounded-full bg-borde transition peer-checked:bg-marca peer-focus-visible:ring-2 peer-focus-visible:ring-marca/40" />
        <span className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
