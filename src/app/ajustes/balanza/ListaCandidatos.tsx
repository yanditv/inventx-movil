"use client";

import { useState } from "react";
import { CheckCircle, CircleNotch, Scales, WarningCircle, XCircle } from "@phosphor-icons/react";
import type { Candidato } from "@/lib/asistenteBalanza";
import { money as usd } from "@/lib/calculos";

type Accion = "LB" | "KG" | "DESCARTAR";

export default function ListaCandidatos({ inicial, permitido }: { inicial: Candidato[]; permitido: boolean }) {
  const [items, setItems] = useState(inicial);
  const [hechos, setHechos] = useState<{ descripcion: string; resultado: string }[]>([]);

  if (items.length === 0)
    return (
      <div className="space-y-3">
        {hechos.length > 0 && <Resumen hechos={hechos} />}
        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-borde px-6 py-10 text-center">
          <CheckCircle size={40} weight="duotone" className="text-exito" />
          <p className="font-semibold text-texto">No hay productos por revisar</p>
          <p className="text-sm text-gris">Cuando se cree un producto con “libra” o “kilo” en el nombre aparecerá aquí.</p>
        </div>
      </div>
    );

  return (
    <div className="space-y-3">
      {hechos.length > 0 && <Resumen hechos={hechos} />}
      <p className="text-xs font-bold uppercase tracking-wider text-gris">
        {items.length} {items.length === 1 ? "sugerencia" : "sugerencias"}
      </p>
      <ul className="space-y-3">
        {items.map((c) => (
          <Tarjeta
            key={c.idProducto}
            c={c}
            permitido={permitido}
            onListo={(resultado) => {
              setItems((xs) => xs.filter((x) => x.idProducto !== c.idProducto));
              setHechos((h) => [{ descripcion: c.descripcion, resultado }, ...h]);
            }}
          />
        ))}
      </ul>
    </div>
  );
}

function Resumen({ hechos }: { hechos: { descripcion: string; resultado: string }[] }) {
  return (
    <ul className="space-y-1 rounded-lg bg-exito/10 p-3 text-sm text-exito">
      {hechos.slice(0, 5).map((h, i) => (
        <li key={i} className="flex items-start gap-2">
          <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0" />
          <span>
            <b>{h.descripcion}</b>: {h.resultado}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Tarjeta({ c, permitido, onListo }: { c: Candidato; permitido: boolean; onListo: (resultado: string) => void }) {
  const [cambiarPlu, setCambiarPlu] = useState(!c.pluValido && !!c.pluSugerido);
  const [plu, setPlu] = useState(c.pluSugerido ?? "");
  const [enviando, setEnviando] = useState<Accion | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decidir(accion: Accion) {
    setEnviando(accion);
    setError(null);
    try {
      const r = await fetch("/api/balanza/candidatos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idProducto: c.idProducto, accion, nuevoCodigo: accion !== "DESCARTAR" && cambiarPlu ? plu : undefined }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "No se pudo guardar");
      onListo(
        accion === "DESCARTAR"
          ? "no se vende por peso"
          : `por ${accion === "LB" ? "libra" : "kilo"}${cambiarPlu ? `, PLU ${plu}` : `, PLU ${c.codigo}`}`
      );
    } catch (e) {
      setError((e as Error).message);
      setEnviando(null);
    }
  }

  const pluFinal = cambiarPlu ? plu : c.pluValido ? c.codigo : null;
  const boton = (accion: Accion, texto: string, sugerido: boolean) => (
    <button
      key={accion}
      disabled={!permitido || enviando !== null || (accion !== "DESCARTAR" && !pluFinal)}
      onClick={() => decidir(accion)}
      className={`btn px-2 py-2.5 text-sm ${
        accion === "DESCARTAR"
          ? "border border-borde bg-white text-gris"
          : sugerido
            ? "bg-marca text-white"
            : "border border-marca/40 bg-white text-marca-oscuro"
      }`}
    >
      {enviando === accion ? (
        <CircleNotch size={18} className="animate-spin" />
      ) : accion === "DESCARTAR" ? (
        <XCircle size={18} />
      ) : (
        <Scales size={18} weight={sugerido ? "fill" : "regular"} />
      )}
      {texto}
    </button>
  );

  return (
    <li className="rounded-xl border border-borde bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-texto">{c.descripcion}</p>
          <p className="num text-sm text-gris">
            Código {c.codigo} · {usd(c.precio)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-marca/10 px-2 py-0.5 text-xs font-bold text-marca-oscuro">
          ¿Por {c.unidadSugerida === "LB" ? "libra" : "kilo"}?
        </span>
      </div>

      {!c.pluValido && (
        <div className="mt-3 rounded-lg bg-aviso/10 p-3 text-sm text-[#92400e]">
          <p className="flex items-start gap-1.5">
            <WarningCircle size={16} weight="fill" className="mt-0.5 shrink-0" />
            El código “{c.codigo}” no se puede imprimir en la etiqueta de la balanza (debe ser numérico corto).
          </p>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={cambiarPlu} onChange={(e) => setCambiarPlu(e.target.checked)} className="h-4 w-4 accent-marca" />
            Cambiar el código a PLU
            <input
              inputMode="numeric"
              value={plu}
              onChange={(e) => setPlu(e.target.value.replace(/\D/g, ""))}
              disabled={!cambiarPlu}
              aria-label="Nuevo PLU"
              className="num w-20 rounded border border-borde bg-white px-2 py-1 text-texto disabled:opacity-50"
            />
          </label>
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {boton("LB", "Por libra", c.unidadSugerida === "LB")}
        {boton("KG", "Por kilo", c.unidadSugerida === "KG")}
        {boton("DESCARTAR", "No", false)}
      </div>
      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-peligro">
          <WarningCircle size={16} weight="fill" className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
    </li>
  );
}
