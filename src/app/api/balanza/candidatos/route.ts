import { conSesion } from "@/lib/api";
import { aplicarDecision, candidatosBalanza, type Decision } from "@/lib/asistenteBalanza";

export const GET = conSesion(async () => candidatosBalanza());

// Confirma un candidato como producto por libra/kilo (opcionalmente con su nuevo PLU) o lo descarta.
export const POST = conSesion(async (sesion, req) => {
  const b = (await req.json()) as Partial<Decision>;
  return aplicarDecision(sesion, {
    idProducto: Number(b.idProducto),
    accion: b.accion as Decision["accion"],
    nuevoCodigo: b.nuevoCodigo ? String(b.nuevoCodigo) : undefined,
  });
});
