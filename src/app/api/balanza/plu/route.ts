import { getSesion } from "@/lib/session";
import { productosParaBalanza } from "@/lib/balanza";

// CSV con los productos por peso para importarlos en el programa de la balanza (CL-Works, Cuora, etc.).
export async function GET() {
  if (!(await getSesion())) return new Response("Sesion expirada", { status: 401 });
  const { validos } = await productosParaBalanza();
  const celda = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const filas = [
    "PLU;NOMBRE;PRECIO;UNIDAD;IVA",
    ...validos.map((p) => [p.plu, celda(p.descripcion.slice(0, 40)), p.precio.toFixed(2), p.unidad, p.aplicaIVA ? "SI" : "NO"].join(";")),
  ];
  const fecha = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + filas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="plu-balanza-${fecha}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
