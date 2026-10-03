import { PERMISO, tiene } from "@/lib/seguridad";
import { conSesion, idValido } from "@/lib/api";
import { actualizarCliente, ErrorVenta, getCliente, type NuevoCliente } from "@/lib/ventas";

export const GET = conSesion(async (_s, _req, params) => {
  const c = await getCliente(idValido(params.id));
  if (!c) throw new ErrorVenta("El cliente ya no existe");
  return c;
});

export const PUT = conSesion(async (sesion, req, params) => {
  if (!tiene(sesion, PERMISO.CLIENTES)) throw new ErrorVenta("Su rol no tiene permiso para crear o editar clientes");
  const b = (await req.json()) as Partial<NuevoCliente>;
  return actualizarCliente(idValido(params.id), {
    nroIdentificacion: String(b.nroIdentificacion ?? ""),
    idTipoIdentificacion: String(b.idTipoIdentificacion ?? ""),
    nombres: String(b.nombres ?? ""),
    apellidos: String(b.apellidos ?? ""),
    telefono: String(b.telefono ?? ""),
    correo: String(b.correo ?? ""),
    direccion: String(b.direccion ?? ""),
    confirmarIdentificacion: b.confirmarIdentificacion === true,
  });
});
