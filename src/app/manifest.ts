import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "InventX Ventas",
    short_name: "InventX",
    description: "Registre sus ventas de InventX desde el celular o la PC",
    lang: "es-EC",
    start_url: "/ventas",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#f7f7f7",
    theme_color: "#f9f9f9",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Nueva venta",
        short_name: "Vender",
        url: "/ventas/nueva",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      { name: "Ventas de hoy", url: "/ventas" },
    ],
  };
}
