import Link from "next/link";
import { redirect } from "next/navigation";
import { CaretLeft, Info, LockSimple } from "@phosphor-icons/react/ssr";
import { candidatosBalanza } from "@/lib/asistenteBalanza";
import { getSesion } from "@/lib/session";
import { PERMISO, tiene } from "@/lib/seguridad";
import ListaCandidatos from "./ListaCandidatos";

export const metadata = { title: "Productos por peso · InventX" };

export default async function AsistenteBalanzaPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");
  const candidatos = await candidatosBalanza();
  const permitido = tiene(sesion, PERMISO.PRODUCTOS);

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-10">
      <header className="barra-marca pt-seguro sticky top-0 z-10 px-4 pb-4 text-white shadow-md">
        <div className="flex items-center gap-2">
          <Link href="/ajustes" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-lg active:bg-white/15" aria-label="Volver">
            <CaretLeft size={24} weight="bold" />
          </Link>
          <div>
            <h1 className="text-lg font-bold leading-tight">Productos por peso</h1>
            <p className="text-xs text-white/80">Sugerencias según el nombre</p>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4 pt-4">
        <p className="flex gap-2 rounded-lg border border-borde bg-white p-3 text-sm leading-relaxed text-gris">
          <Info size={18} className="mt-0.5 shrink-0 text-marca" />
          <span>
            Estos productos dicen <b className="text-texto">libra</b> o <b className="text-texto">kilo</b> en el nombre pero su unidad es
            NINGUNA o UNIDAD. Confirme cuáles se venden pesados. Los paquetes cerrados como “2 libras” o “1Kg” ya se excluyeron.
          </span>
        </p>
        {!permitido && (
          <p className="flex items-start gap-2 rounded-lg bg-aviso/10 p-3 text-sm text-[#92400e]">
            <LockSimple size={18} weight="fill" className="mt-0.5 shrink-0" />
            Su rol no tiene permiso para modificar productos. Pida al administrador que lo habilite en Ajustes &gt; Permisos.
          </p>
        )}
        <ListaCandidatos inicial={candidatos} permitido={permitido} />
      </div>
    </main>
  );
}
