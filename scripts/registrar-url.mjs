// Guarda la direccion de la app web en la base (parametro URL_APP_WEB) para que InventX escritorio
// muestre el QR en Ajustes > Puntos web, y muestra el QR en la terminal.
// Uso: node scripts/registrar-url.mjs https://inventx.mi-red.ts.net   (lo ejecuta deploy/instalar.ps1)
import fs from "node:fs";
import sql from "mssql";
import QRCode from "qrcode";

const url = (process.argv[2] || "").trim();
if (!/^https?:\/\/\S+$/.test(url)) {
  console.error("Uso: node scripts/registrar-url.mjs https://direccion-de-la-app");
  process.exit(1);
}

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
  await pool
    .request()
    .input("v", sql.VarChar(500), url)
    .query(
      `IF EXISTS (SELECT 1 FROM dbo.Parametro WHERE IDParametro = 'URL_APP_WEB')
         UPDATE dbo.Parametro SET ValorParametro = @v WHERE IDParametro = 'URL_APP_WEB'
       ELSE
         INSERT INTO dbo.Parametro (IDParametro, ValorParametro) VALUES ('URL_APP_WEB', @v)`
    );
  await pool.close();
  console.log(`Dirección registrada: ${url} (InventX escritorio la muestra en Ajustes > Puntos web)`);
} catch (e) {
  console.error(`No se pudo guardar la dirección en la base: ${e.message}`);
}

console.log("");
console.log((await QRCode.toString(url, { type: "terminal", small: true })).replace(/^/gm, "  "));
console.log(`  ${url}`);
console.log("");
