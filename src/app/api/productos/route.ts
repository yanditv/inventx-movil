import { conSesion } from "@/lib/api";
import { leerEtiquetaBalanza } from "@/lib/balanza";
import { buscarProductos } from "@/lib/ventas";

export const GET = conSesion(async (_s, req) => {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return [];
  const productos = await buscarProductos(q.slice(0, 100));
  // Igual que el escritorio: primero el codigo normal; si no existe, se prueba como etiqueta de balanza.
  if (!productos.some((p) => p.Codigo.trim() === q)) {
    const pesado = await leerEtiquetaBalanza(q);
    if (pesado) return [pesado];
  }
  return productos;
});
