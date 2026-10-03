import type { Metadata, Viewport } from "next";
import { Noto_Sans } from "next/font/google";
import { RegistrarServiceWorker } from "@/components/pwa";
import "./globals.css";

// Segoe UI (la fuente del escritorio) no existe en Android; Noto Sans es la alternativa mas cercana.
const noto = Noto_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-noto" });

export const metadata: Metadata = {
  title: "InventX Ventas",
  description: "Registre sus ventas de InventX desde el celular",
  applicationName: "InventX Ventas",
  appleWebApp: { capable: true, title: "InventX", statusBarStyle: "default" },
  icons: {
    icon: "/icon.png",
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#286090",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${noto.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
