// Arma la carpeta lista para instalar en Windows a partir de "npm run build" (output: "standalone").
// Uso: npm run build && node scripts/empaquetar.mjs [carpeta-salida]   (por defecto dist/inventx-movil)
// La usa .github/workflows/release.yml; el ZIP resultante se instala con deploy\instalar.ps1 sin npm.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { nodeFileTrace } = require("next/dist/compiled/@vercel/nft");

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const salida = path.resolve(raiz, process.argv[2] || "dist/inventx-movil");
const standalone = path.join(raiz, ".next", "standalone");
if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("Falta .next/standalone/server.js: ejecute primero npm run build (con output: \"standalone\").");
  process.exit(1);
}

const copiar = (desde, hasta) => fs.cpSync(desde, hasta, { recursive: true, dereference: true });
fs.rmSync(salida, { recursive: true, force: true });

// 1. Servidor autocontenido + archivos estaticos (standalone no los incluye)
copiar(standalone, salida);
copiar(path.join(raiz, ".next", "static"), path.join(salida, ".next", "static"));
copiar(path.join(raiz, "public"), path.join(salida, "public"));

// 2. Instalador y scripts que usa (probar la base y registrar la URL), con sus dependencias trazadas
copiar(path.join(raiz, "deploy"), path.join(salida, "deploy"));
const scripts = ["scripts/probar-conexion.mjs", "scripts/registrar-url.mjs"];
const { fileList } = await nodeFileTrace(scripts.map((s) => path.join(raiz, s)), { base: raiz });
for (const archivo of fileList) {
  const destino = path.join(salida, archivo);
  if (fs.existsSync(destino)) continue;
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  copiar(path.join(raiz, archivo), destino);
}

// 3. Configuracion: solo la plantilla. Nunca se empaqueta un .env con contraseñas.
for (const f of fs.readdirSync(salida)) if (f.startsWith(".env")) fs.rmSync(path.join(salida, f), { force: true });
fs.copyFileSync(path.join(raiz, ".env.example"), path.join(salida, ".env.example"));
fs.writeFileSync(path.join(salida, "VERSION"), (process.env.VERSION_APP || "local") + "\n");

const tamano = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).reduce((t, e) => t + (e.isDirectory() ? tamano(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`Paquete listo: ${salida} (${(tamano(salida) / 1048576).toFixed(1)} MB, ${fileList.size} archivos de scripts trazados)`);
