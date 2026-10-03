import { conSesion, idValido } from "@/lib/api";
import { estadoImpresion, solicitarImpresion } from "@/lib/impresion";

// Deja el ticket de la venta en la cola de impresion de la caja.
export const POST = conSesion(async (sesion, _req, params) => {
  const idCola = await solicitarImpresion(sesion, idValido(params.id));
  return estadoImpresion(sesion, idCola);
});
