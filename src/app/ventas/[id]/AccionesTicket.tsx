"use client";

import { useState } from "react";
import { FilePdf, ShareNetwork, Check } from "@phosphor-icons/react";

/** Compartir el ticket como texto (WhatsApp, correo...) o guardarlo como PDF con la impresion del navegador. */
export default function AccionesTicket({ texto, titulo }: { texto: string; titulo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function compartir() {
    const datos = { title: titulo, text: texto };
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(datos))) {
        await navigator.share(datos);
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {}
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <button className="btn-secundario" onClick={compartir}>
        {copiado ? <Check size={20} weight="bold" className="text-exito" /> : <ShareNetwork size={20} weight="duotone" />}
        {copiado ? "Copiado" : "Compartir"}
      </button>
      <button className="btn-secundario" onClick={() => window.print()}>
        <FilePdf size={20} weight="duotone" /> Guardar PDF
      </button>
    </div>
  );
}
