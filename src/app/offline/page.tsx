import { WifiSlash } from "@phosphor-icons/react/ssr";
import Logo from "@/components/Logo";
import BotonReintentar from "./BotonReintentar";

export const metadata = { title: "Sin conexión · InventX" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-fondo px-6 text-center">
      <Logo className="h-12 w-12" />
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-marca/10 text-marca-oscuro">
        <WifiSlash size={40} weight="duotone" />
      </div>
      <div className="max-w-xs space-y-2">
        <h1 className="text-xl font-bold text-texto">Sin conexión</h1>
        <p className="text-sm text-gris">
          Las ventas se guardan directamente en el sistema. Conéctese a internet o a la red del local para continuar.
        </p>
      </div>
      <BotonReintentar />
    </main>
  );
}
