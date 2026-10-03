import "server-only";
import { getPool, sql } from "./db";
import type { Sesion } from "./session";

// Roles y permisos compartidos con InventX escritorio (Ajustes > Permisos y Usuarios).
// Tablas: Permiso, PermisoTipoPersonal, EmpleadoPuntoAcceso (Database/Scripts/CreateTable_Permisos_PuntosUsuario.sql).

export const PERMISO = {
  VENTAS_REGISTRAR: "VENTAS_REGISTRAR",
  VENTAS_VER_TODAS: "VENTAS_VER_TODAS",
  CLIENTES: "CLIENTES",
  PRODUCTOS: "PRODUCTOS",
  APP_WEB: "APP_WEB",
} as const;

export const ROL_ADMINISTRADOR = 1;

/** Permisos del rol. null = las tablas de permisos no existen en esta base (no se restringe). */
export async function permisosDeRol(idTipoPersonal: number): Promise<string[] | null> {
  const pool = await getPool();
  const existe = await pool.request().query<{ id: number | null }>("SELECT OBJECT_ID('dbo.PermisoTipoPersonal') AS id");
  if (existe.recordset[0]?.id == null) return null;
  const r = await pool
    .request()
    .input("t", sql.Int, idTipoPersonal)
    .query<{ IDPermiso: string }>("SELECT IDPermiso FROM dbo.PermisoTipoPersonal WHERE IDTipoPersonal = @t");
  return r.recordset.map((x) => x.IDPermiso.trim());
}

/** El Administrador siempre tiene todo; sin tablas de permisos tampoco se restringe. */
export function tiene(sesion: Pick<Sesion, "esAdmin" | "permisos">, permiso: string) {
  return Boolean(sesion.esAdmin) || sesion.permisos == null || sesion.permisos.includes(permiso);
}

/** Puntos asignados al usuario. Lista vacia = puede usar todos los de su sucursal. */
export async function puntosAsignados(idEmpleado: number): Promise<{ idPuntoAcceso: number; idSucursal: number }[]> {
  const pool = await getPool();
  const existe = await pool.request().query<{ id: number | null }>("SELECT OBJECT_ID('dbo.EmpleadoPuntoAcceso') AS id");
  if (existe.recordset[0]?.id == null) return [];
  const r = await pool
    .request()
    .input("e", sql.BigInt, idEmpleado)
    .query<{ IDPuntoAcceso: number; IDSucursal: number }>(
      "SELECT IDPuntoAcceso, IDSucursal FROM dbo.EmpleadoPuntoAcceso WHERE IDEmpleado = @e"
    );
  return r.recordset.map((x) => ({ idPuntoAcceso: x.IDPuntoAcceso, idSucursal: x.IDSucursal }));
}
