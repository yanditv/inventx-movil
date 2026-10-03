import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export type Sesion = {
  idEmpleado: number;
  usuario: string;
  nombre: string;
  idSucursal: number;
  idEmpresa: number;
  /** TipoPersonal: 1 Administrador, 3 Gerente, 4 Supervisor, 7 Vendedor... */
  idTipoPersonal?: number;
  /** El Administrador tiene todos los permisos. */
  esAdmin?: boolean;
  /** Permisos del rol (Ajustes > Permisos del escritorio). null = la base no tiene tablas de permisos. */
  permisos?: string[] | null;
  // Se completa al elegir el punto de acceso (caja / punto de emision).
  idPuntoAcceso?: number;
};

const COOKIE = "inventx_session";
const DURACION_HORAS = 12;

function secreto() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET no configurado (minimo 32 caracteres)");
  return new TextEncoder().encode(s);
}

export async function crearSesion(sesion: Sesion) {
  const token = await new SignJWT({ ...sesion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_HORAS}h`)
    .sign(secreto());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_HORAS * 3600,
  });
}

export async function leerToken(token: string | undefined): Promise<Sesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secreto(), { algorithms: ["HS256"] });
    // Sesiones creadas antes de los permisos: se pide iniciar sesion de nuevo.
    if (!("permisos" in payload)) return null;
    return payload as unknown as Sesion;
  } catch {
    return null;
  }
}

export async function getSesion() {
  return leerToken((await cookies()).get(COOKIE)?.value);
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE);
}

export const SESSION_COOKIE = COOKIE;
