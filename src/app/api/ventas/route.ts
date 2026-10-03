import { conSesion } from "@/lib/api";
import { registrarVenta, type VentaInput } from "@/lib/ventas";

export const POST = conSesion(async (sesion, req) => {
  const body = (await req.json()) as VentaInput;
  return registrarVenta(sesion, body);
});
