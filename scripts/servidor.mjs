// Inicia Next.js y muestra en la terminal la direccion de red con un QR para abrirla desde el celular u otra PC.
// Uso (desde package.json):  node scripts/servidor.mjs dev | start [--https] [-p 3000]
// Si existe APP_URL (por ejemplo la direccion https://...ts.net de Tailscale), el QR apunta a ella.
import { spawn } from "node:child_process";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import QRCode from "qrcode";

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const [modo = "dev", ...resto] = process.argv.slice(2);
const https = resto.includes("--https");
const argsUsuario = resto.filter((a) => a !== "--https");

// Puerto: -p/--port, luego PORT, luego 3000
const iPuerto = argsUsuario.findIndex((a) => a === "-p" || a === "--port");
const puerto = iPuerto >= 0 ? argsUsuario[iPuerto + 1] : process.env.PORT || "3000";
// Host: en la red local (0.0.0.0) salvo que se indique otro con -H
const tieneHost = argsUsuario.some((a) => a === "-H" || a === "--hostname");

// APP_URL desde el entorno o desde .env.local
function leerAppUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  try {
    const env = fs.readFileSync(path.join(raiz, ".env.local"), "utf8");
    return env.match(/^\s*APP_URL\s*=\s*(.+?)\s*$/m)?.[1];
  } catch {
    return undefined;
  }
}

// Direcciones IPv4 de la red (LAN y Tailscale 100.x), sin las internas ni las de VirtualBox/Hyper-V
function direccionesRed() {
  const ips = [];
  for (const [nombre, lista] of Object.entries(os.networkInterfaces())) {
    for (const d of lista ?? []) {
      if (d.family !== "IPv4" || d.internal || d.address.startsWith("169.254.")) continue;
      if (/vEthernet|VirtualBox|Docker|WSL/i.test(nombre)) continue;
      ips.push({ nombre, ip: d.address, tailscale: d.address.startsWith("100.") });
    }
  }
  // Primero la red local, despues Tailscale
  return ips.sort((a, b) => Number(a.tailscale) - Number(b.tailscale));
}

async function mostrarQr() {
  const esquema = https ? "https" : "http";
  const appUrl = leerAppUrl();
  const ips = direccionesRed();
  const principal = appUrl || (ips[0] ? `${esquema}://${ips[0].ip}:${puerto}` : `${esquema}://localhost:${puerto}`);
  const qr = await QRCode.toString(principal, { type: "terminal", small: true, errorCorrectionLevel: "M" });

  const azul = (t) => `\x1b[36m${t}\x1b[0m`;
  const gris = (t) => `\x1b[90m${t}\x1b[0m`;
  console.log("");
  console.log(azul("  InventX Ventas — abra la app desde el celular o desde otra PC de la red:"));
  console.log("");
  console.log(qr.replace(/^/gm, "  "));
  console.log(`  ${azul(principal)}`);
  for (const d of ips) {
    const url = `${esquema}://${d.ip}:${puerto}`;
    if (url !== principal) console.log(gris(`  también: ${url}  (${d.tailscale ? "Tailscale" : d.nombre})`));
  }
  if (!https && !appUrl) {
    console.log(gris("  Nota: la cámara (escáner) y la instalación de la app necesitan HTTPS: use npm run dev:https."));
  }
  console.log("");
}

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const args = [nextBin, modo, ...argsUsuario];
if (!tieneHost) args.push("-H", "0.0.0.0");
if (iPuerto < 0) args.push("-p", puerto);
if (https && modo === "dev") args.push("--experimental-https");

const hijo = spawn(process.execPath, args, { cwd: raiz, stdio: ["inherit", "pipe", "inherit"], env: process.env });
let mostrado = false;
hijo.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  // Se muestra el QR cuando Next termina de arrancar ("Ready" / "Listo").
  if (!mostrado && /Ready in|ready started|Local:/i.test(chunk.toString())) {
    mostrado = true;
    setTimeout(() => mostrarQr().catch(() => {}), 300);
  }
});
hijo.on("exit", (codigo) => process.exit(codigo ?? 0));
for (const senal of ["SIGINT", "SIGTERM"]) process.on(senal, () => hijo.kill(senal));
