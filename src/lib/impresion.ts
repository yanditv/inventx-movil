import "server-only";
import { AHORA, getPool, sql } from "./db";
import type { Sesion } from "./session";
import { ErrorVenta, getPuntoAcceso } from "./ventas";
import { PERMISO, tiene } from "./seguridad";

// Cola de impresion (dbo.ColaImpresion). El celular deja el pedido y InventX escritorio,
// abierto en la caja, lo imprime con el mismo reporte y la misma impresora de ticket.

export type EstadoImpresion = {
  idCola: number;
  estado: "PENDIENTE" | "IMPRIMIENDO" | "IMPRESO" | "ERROR";
  mensaje: string | null;
  impresora: string | null;
  fechaSolicitud: string;
  fechaProceso: string | null;
};

const INSERT_COLA = `
  INSERT INTO dbo.ColaImpresion (IDVenta, IDPuntoVenta, IDSucursal, IDEmpleado, Origen, FechaSolicitud)
  VALUES (@colaVenta, @colaPunto, @colaSucursal, @colaEmpleado, 'MOVIL', ${AHORA});
  SELECT CAST(SCOPE_IDENTITY() AS bigint) AS IDCola;`;

export async function solicitarImpresion(sesion: Sesion, idVenta: number) {
  if (!sesion.idPuntoAcceso) throw new ErrorVenta("Seleccione un punto de acceso");
  const pool = await getPool();
  const venta = await pool
    .request()
    .input("v", sql.BigInt, idVenta)
    .input("p", sql.Int, sesion.idPuntoAcceso)
    .input("s", sql.Int, sesion.idSucursal)
    .input("emp", sql.BigInt, sesion.idEmpleado)
    .input("todas", sql.Bit, tiene(sesion, PERMISO.VENTAS_VER_TODAS))
    .query(`SELECT 1 FROM dbo.Venta WHERE IDVenta = @v AND IDPuntoVenta = @p AND IDSucursal = @s AND (@todas = 1 OR IDEmpleado = @emp)`);
  if (!venta.recordset.length) throw new ErrorVenta("La venta no pertenece a esta caja");
  const pa = await getPuntoAcceso(sesion.idPuntoAcceso, sesion.idSucursal);
  if (pa?.EsWeb && !pa.IDPuntoImpresion)
    throw new ErrorVenta("Este punto web no tiene una caja asignada para imprimir. Asígnela en el escritorio: Ajustes > Puntos web.");

  // Evita pedidos duplicados si se toca "Imprimir" varias veces seguidas.
  const pendiente = await pool
    .request()
    .input("v", sql.BigInt, idVenta)
    .input("p", sql.Int, sesion.idPuntoAcceso)
    .input("s", sql.Int, sesion.idSucursal)
    .query<{ IDCola: number }>(
      `SELECT TOP 1 IDCola FROM dbo.ColaImpresion
        WHERE IDVenta = @v AND IDPuntoVenta = @p AND IDSucursal = @s AND Estado IN ('PENDIENTE', 'IMPRIMIENDO')
        ORDER BY IDCola DESC`
    );
  if (pendiente.recordset[0]) return Number(pendiente.recordset[0].IDCola);

  const r = await pool
    .request()
    .input("colaVenta", sql.BigInt, idVenta)
    .input("colaPunto", sql.Int, sesion.idPuntoAcceso)
    .input("colaSucursal", sql.Int, sesion.idSucursal)
    .input("colaEmpleado", sql.BigInt, sesion.idEmpleado)
    .query<{ IDCola: number }>(INSERT_COLA);
  return Number(r.recordset[0].IDCola);
}

export async function estadoImpresion(sesion: Sesion, idCola: number): Promise<EstadoImpresion | null> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("id", sql.BigInt, idCola)
    .input("s", sql.Int, sesion.idSucursal)
    .query<{
      IDCola: number;
      Estado: EstadoImpresion["estado"];
      Mensaje: string | null;
      Impresora: string | null;
      FechaSolicitud: Date;
      FechaProceso: Date | null;
    }>(
      `SELECT IDCola, Estado, Mensaje, Impresora, FechaSolicitud, FechaProceso
         FROM dbo.ColaImpresion WHERE IDCola = @id AND IDSucursal = @s`
    );
  const x = r.recordset[0];
  if (!x) return null;
  return {
    idCola: Number(x.IDCola),
    estado: x.Estado,
    mensaje: x.Mensaje,
    impresora: x.Impresora,
    fechaSolicitud: new Date(x.FechaSolicitud).toISOString(),
    fechaProceso: x.FechaProceso ? new Date(x.FechaProceso).toISOString() : null,
  };
}

export async function ultimoEstadoPorVenta(sesion: Sesion, idVenta: number) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("v", sql.BigInt, idVenta)
    .input("p", sql.Int, sesion.idPuntoAcceso ?? 0)
    .input("s", sql.Int, sesion.idSucursal)
    .query<{ IDCola: number }>(
      `SELECT TOP 1 IDCola FROM dbo.ColaImpresion
        WHERE IDVenta = @v AND IDPuntoVenta = @p AND IDSucursal = @s ORDER BY IDCola DESC`
    );
  const id = r.recordset[0]?.IDCola;
  return id ? estadoImpresion(sesion, Number(id)) : null;
}

/** Impresora de ticket configurada para la caja y ultima vez que el escritorio proceso un pedido. */
export async function infoImpresoraCaja(sesion: Sesion) {
  const pa = sesion.idPuntoAcceso ? await getPuntoAcceso(sesion.idPuntoAcceso, sesion.idSucursal) : null;
  const pool = await getPool();
  const r = await pool
    .request()
    .input("p", sql.Int, sesion.idPuntoAcceso ?? 0)
    .input("s", sql.Int, sesion.idSucursal)
    .query<{ UltimoProceso: Date | null; UltimoEstado: string | null; UltimoMensaje: string | null }>(
      `SELECT TOP 1 FechaProceso AS UltimoProceso, Estado AS UltimoEstado, Mensaje AS UltimoMensaje
         FROM dbo.ColaImpresion
        WHERE IDPuntoVenta = @p AND IDSucursal = @s AND FechaProceso IS NOT NULL
        ORDER BY FechaProceso DESC`
    );
  const x = r.recordset[0];
  return {
    // En un punto web es la impresora de la caja asignada en Ajustes > Puntos web.
    caja: pa?.PuntoImpresion?.trim() || null,
    impresora: pa?.IDPuntoImpresion ? pa.ImpresoraTicket?.trim() || null : null,
    ultimoProceso: x?.UltimoProceso ? new Date(x.UltimoProceso).toISOString() : null,
    ultimoEstado: x?.UltimoEstado ?? null,
    ultimoMensaje: x?.UltimoMensaje ?? null,
  };
}
