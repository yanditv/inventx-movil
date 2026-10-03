// Inicia Next.js y muestra en la terminal la direccion de red con un QR para abrirla desde el celular u otra PC.
// Uso (desde package.json):  node scripts/servidor.mjs dev | start [--https] [-p 3000]
// El QR usa APP_URL si existe; si no, la direccion HTTPS de Tailscale (equipo.red.ts.net) cuando responde; si no, la red local.
import { spawn, spawnSync } from "node:child_process";
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

// Nombre MagicDNS de este equipo en Tailscale (equipo.red.ts.net), si Tailscale esta instalado y conectado.
function nombreTailscale() {
  const candidatos = ["tailscale", "C:\\Program Files\\Tailscale\\tailscale.exe", "/Applications/Tailscale.app/Contents/MacOS/Tailscale"];
  for (const exe of candidatos) {
    try {
      const r = spawnSync(exe, ["status", "--json"], { encoding: "utf8", timeout: 4000, windowsHide: true });
      if (r.status !== 0 || !r.stdout) continue;
      const estado = JSON.parse(r.stdout);
      const dns = estado?.Self?.DNSName?.replace(/\.$/, "");
      if (estado?.BackendState === "Running" && dns?.endsWith(".ts.net")) return dns;
    } catch {
      // no instalado en esa ruta
    }
  }
  return null;
}

// true si la direccion https responde con un certificado valido (fetch rechaza certificados invalidos).
async function respondeHttps(url) {
  try {
    const r = await fetch(url + "/login", { method: "HEAD", signal: AbortSignal.timeout(4000), redirect: "manual" });
    return r.status < 500;
  } catch {
    return false;
  }
}

async function mostrarQr() {
  const esquema = https ? "https" : "http";
  const ips = direccionesRed();
  const lan = ips[0] ? `${esquema}://${ips[0].ip}:${puerto}` : `${esquema}://localhost:${puerto}`;

  // Prioridad: APP_URL > https de Tailscale (si responde) > red local
  const appUrl = leerAppUrl()?.replace(/\/$/, "");
  const ts = nombreTailscale();
  const urlTs = ts ? `https://${ts}` : null;
  const tsResponde = urlTs && !appUrl ? await respondeHttps(urlTs) : false;
  const principal = appUrl || (tsResponde ? urlTs : lan);
  const qr = await QRCode.toString(principal, { type: "terminal", small: true, errorCorrectionLevel: "M" });

  const azul = (t) => `\x1b[36m${t}\x1b[0m`;
  const gris = (t) => `\x1b[90m${t}\x1b[0m`;
  const amarillo = (t) => `\x1b[33m${t}\x1b[0m`;
  console.log("");
  console.log(azul("  InventX Ventas — abra la app desde el celular o desde otra PC:"));
  console.log("");
  console.log(qr.replace(/^/gm, "  "));
  console.log(`  ${azul(principal)}${principal === urlTs ? gris("  (Tailscale, HTTPS)") : ""}`);
  const otras = [...(urlTs && urlTs !== principal && tsResponde ? [urlTs] : []), ...(principal !== lan ? [lan] : [])];
  for (const d of ips) {
    const url = `${esquema}://${d.ip}:${puerto}`;
    if (url !== principal && !otras.includes(url)) otras.push(url);
  }
  for (const url of otras) console.log(gris(`  también: ${url}`));

  if (ts && !tsResponde && !appUrl) {
    console.log(amarillo(`  Tailscale detectado (${ts}), pero https://${ts} aún no responde.`));
    console.log(gris("  Para usarlo con HTTPS: instale con deploy\\instalar.ps1 (Caddy) o, para pruebas,"));
    console.log(gris(`  ejecute: tailscale serve --bg ${puerto}   (y vuelva a iniciar)`));
  } else if (!principal.startsWith("https")) {
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
