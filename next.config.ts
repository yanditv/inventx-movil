import type { NextConfig } from "next";
import os from "node:os";

// En desarrollo, permite abrir la app desde otros equipos de la red local o de Tailscale
// (Next bloquea por defecto los recursos de desarrollo pedidos desde otro origen).
const ipsDeRed = Object.values(os.networkInterfaces())
  .flat()
  .filter((d) => d && d.family === "IPv4" && !d.internal)
  .map((d) => d!.address);

// Identifica cada compilacion: el cliente la compara con /api/version para saber si hay una version
// nueva publicada y recargarse (la PWA instalada no se recarga sola).
const versionApp = process.env.VERSION_APP ?? Date.now().toString(36);

const nextConfig: NextConfig = {
  env: { VERSION_APP: versionApp },
  // mssql/tedious usan APIs de Node; se cargan sin empaquetar en el servidor.
  serverExternalPackages: ["mssql", "tedious"],
  allowedDevOrigins: [...ipsDeRed, "**.ts.net"],
  experimental: {
    // Detras de "tailscale serve" el navegador envia el host *.ts.net y el servidor ve localhost:
    // se permite ese origen para que funcionen las acciones del servidor (inicio de sesion, etc.).
    serverActions: { allowedOrigins: ["**.ts.net"] },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // El service worker nunca se cachea para que las actualizaciones lleguen enseguida.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
