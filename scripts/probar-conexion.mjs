// Prueba la conexion a SQL Server con los datos de .env.local (lo usa deploy/instalar.ps1).
// Uso: node scripts/probar-conexion.mjs
import fs from "node:fs";
import sql from "mssql";

const env = {};
for (const linea of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}

const servidor = env.DB_SERVER || "localhost";
const conInstancia = servidor.includes("\\");
try {
  const pool = await new sql.ConnectionPool({
    server: servidor,
    port: !conInstancia && env.DB_PORT ? Number(env.DB_PORT) : undefined,
    database: env.DB_NAME || "ventas",
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    connectionTimeout: 8000,
    options: { encrypt: env.DB_ENCRYPT === "true", trustServerCertificate: env.DB_TRUST_CERT !== "false" },
  }).connect();
  const r = await pool.request().query("SELECT DB_NAME() AS base, (SELECT COUNT(*) FROM dbo.Venta) AS ventas");
  console.log(`OK: base ${r.recordset[0].base}, ${r.recordset[0].ventas} ventas`);
  await pool.close();
} catch (e) {
  console.error(`No se pudo conectar a ${servidor}${!conInstancia && env.DB_PORT ? "," + env.DB_PORT : ""}: ${e.message}`);
  if (/ESOCKET|ETIMEOUT|Could not connect|Failed to connect/i.test(`${e.code} ${e.message}`)) {
    console.error(
      "Revise en 'SQL Server Configuration Manager' > Protocolos de SQL Server: TCP/IP debe estar habilitado " +
        "(y reinicie el servicio SQL Server). Para una instancia con nombre (EQUIPO\\INSTANCIA) tambien debe correr 'SQL Server Browser'."
    );
  } else if (/Login failed/i.test(e.message)) {
    console.error("Usuario o contraseña de SQL Server incorrectos (DB_USER / DB_PASSWORD). Debe ser un usuario SQL, no de Windows.");
  }
  process.exit(1);
}
