import { conSesion } from "@/lib/api";
import { leerEtiquetaBalanza } from "@/lib/balanza";
import { crearProductoRapido, type NuevoProducto } from "@/lib/productos";
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

// Alta rapida cuando el producto no existe (requiere el permiso Productos).
export const POST = conSesion(async (sesion, req) => {
  const b = (await req.json()) as Partial<NuevoProducto>;
  return crearProductoRapido(sesion, {
    codigo: String(b.codigo ?? ""),
    descripcion: String(b.descripcion ?? ""),
    precio: Number(b.precio),
    aplicaIVA: b.aplicaIVA === true,
    unidad: (String(b.unidad ?? "UNIDAD").toUpperCase() as NuevoProducto["unidad"]) || "UNIDAD",
  });
});
