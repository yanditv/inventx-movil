import { conSesion } from "@/lib/api";
import { buscarClientes, crearCliente, type NuevoCliente } from "@/lib/ventas";

export const GET = conSesion(async (_s, req) => {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return [];
  return buscarClientes(q.slice(0, 100));
});

export const POST = conSesion(async (_s, req) => {
  const b = (await req.json()) as Partial<NuevoCliente>;
  return crearCliente({
    nroIdentificacion: String(b.nroIdentificacion ?? ""),
    idTipoIdentificacion: String(b.idTipoIdentificacion ?? "05"),
    nombres: String(b.nombres ?? ""),
    apellidos: String(b.apellidos ?? ""),
    telefono: String(b.telefono ?? ""),
    correo: String(b.correo ?? ""),
    direccion: String(b.direccion ?? ""),
  });
});
