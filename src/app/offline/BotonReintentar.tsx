"use client";

import { ArrowClockwise } from "@phosphor-icons/react";

export default function BotonReintentar() {
  return (
    <button className="btn-primario w-full max-w-xs" onClick={() => window.location.reload()}>
      <ArrowClockwise size={20} weight="bold" />
      Reintentar
    </button>
  );
}
