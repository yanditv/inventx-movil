import { conSesion } from "@/lib/api";
import { buscarProductos } from "@/lib/ventas";

export const GET = conSesion(async (_s, req) => {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return [];
  return buscarProductos(q.slice(0, 100));
});
