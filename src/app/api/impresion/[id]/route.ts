import { conSesion, idValido } from "@/lib/api";
import { estadoImpresion } from "@/lib/impresion";
import { ErrorVenta } from "@/lib/ventas";

// Estado de un pedido de impresion (el celular lo consulta mientras espera).
export const GET = conSesion(async (sesion, _req, params) => {
  const estado = await estadoImpresion(sesion, idValido(params.id));
  if (!estado) throw new ErrorVenta("Pedido de impresion no encontrado");
  return estado;
});
