import "server-only";
import sql from "mssql";

// Pool unico reutilizado entre peticiones (y entre recargas en desarrollo).
const globalForDb = globalThis as unknown as { __inventxPool?: Promise<sql.ConnectionPool> };

function crearPool() {
  // "servidor\INSTANCIA" usa SQL Browser para hallar el puerto; no se puede combinar con DB_PORT.
  const server = process.env.DB_SERVER ?? "localhost";
  const conInstancia = server.includes("\\");
  const config: sql.config = {
    server,
    port: !conInstancia && process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    connectionTimeout: 8000,
    requestTimeout: 30000,
    database: process.env.DB_NAME ?? "ventas",
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    options: {
      encrypt: process.env.DB_ENCRYPT === "true",
      trustServerCertificate: process.env.DB_TRUST_CERT !== "false",
      // Fechas como hora local del servidor, igual que DateTime.Now en el escritorio.
      useUTC: false,
    },
  };
  const pool = new sql.ConnectionPool(config).connect();
  pool.catch(() => {
    globalForDb.__inventxPool = undefined;
  });
  return pool;
}

export function getPool() {
  if (!globalForDb.__inventxPool) globalForDb.__inventxPool = crearPool();
  return globalForDb.__inventxPool;
}

export { sql };

// Hora local para FechaEmision y demas fechas. El escritorio usa DateTime.Now de la PC,
// pero el SQL Server puede estar en UTC (p. ej. Docker), asi que no se usa GETDATE() directo.
// DB_TIMEZONE usa nombres de zona de Windows; vacio = hora del servidor SQL.
const zona = process.env.DB_TIMEZONE ?? "SA Pacific Standard Time";
if (zona && !/^[A-Za-z0-9 .()+-]+$/.test(zona)) throw new Error("DB_TIMEZONE invalido");
export const AHORA = zona ? `CAST(SYSDATETIMEOFFSET() AT TIME ZONE '${zona}' AS datetime)` : "GETDATE()";
