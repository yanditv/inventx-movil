import { WifiSlash } from "@phosphor-icons/react/ssr";
import Logo from "@/components/Logo";
import BotonReintentar from "./BotonReintentar";

export const metadata = { title: "Sin conexión · InventX" };

// data-sin-conexion: VigilanteApp recarga sola esta pantalla apenas el servidor vuelve a responder.
export default function OfflinePage() {
  return (
    <main data-sin-conexion className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-fondo px-6 text-center">
      <Logo className="h-12 w-12" />
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-marca/10 text-marca-oscuro">
        <WifiSlash size={40} weight="duotone" />
      </div>
      <div className="max-w-xs space-y-2">
        <h1 className="text-[22px] font-bold text-texto">No se pudo conectar</h1>
        <p className="text-[15px] text-gris">
          El servidor no responde o no hay red. La app se recargará sola apenas vuelva la conexión.
        </p>
      </div>
      <BotonReintentar />
    </main>
  );
}
