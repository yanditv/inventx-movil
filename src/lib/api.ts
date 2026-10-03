import "server-only";
import { NextResponse } from "next/server";
import { getSesion } from "./session";
import { ErrorVenta } from "./ventas";

// Envuelve un handler de API: exige sesion y traduce errores a JSON.
export function conSesion<T>(fn: (sesion: NonNullable<Awaited<ReturnType<typeof getSesion>>>, req: Request) => Promise<T>) {
  return async (req: Request) => {
    const sesion = await getSesion();
    if (!sesion) return NextResponse.json({ error: "Sesion expirada" }, { status: 401 });
    try {
      return NextResponse.json(await fn(sesion, req));
    } catch (e) {
      if (e instanceof ErrorVenta) return NextResponse.json({ error: e.message }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: "Error interno al procesar la solicitud" }, { status: 500 });
    }
  };
}
