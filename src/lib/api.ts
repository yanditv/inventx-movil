import "server-only";
import { NextResponse } from "next/server";
import { getSesion, type Sesion } from "./session";
import { ErrorVenta } from "./ventas";

type Ctx = { params: Promise<Record<string, string>> };

// Envuelve un handler de API: exige sesion y traduce errores a JSON.
export function conSesion<T>(fn: (sesion: Sesion, req: Request, params: Record<string, string>) => Promise<T>) {
  return async (req: Request, ctx?: Ctx) => {
    const sesion = await getSesion();
    if (!sesion) return NextResponse.json({ error: "Sesion expirada" }, { status: 401 });
    try {
      return NextResponse.json(await fn(sesion, req, ctx ? await ctx.params : {}));
    } catch (e) {
      if (e instanceof ErrorVenta) return NextResponse.json({ error: e.message, confirmable: e.confirmable || undefined }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: "Error interno al procesar la solicitud" }, { status: 500 });
    }
  };
}

export function idValido(valor: string | undefined) {
  const n = Number(valor);
  if (!Number.isSafeInteger(n) || n <= 0) throw new ErrorVenta("Identificador invalido");
  return n;
}
