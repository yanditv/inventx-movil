import { redirect } from "next/navigation";
import { CaretRight, CashRegister, Flask, SignOut, Storefront, Broadcast } from "@phosphor-icons/react/ssr";
import Logo from "@/components/Logo";
import { getSesion } from "@/lib/session";
import { puntosPermitidos, serieDe } from "@/lib/ventas";
import { salir, seleccionarPunto } from "../acciones";

export default async function PuntoPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");
  // Solo los puntos asignados al usuario en Ajustes > Usuarios (o todos si no tiene asignados).
  const puntos = await puntosPermitidos(sesion);
  const empresa = puntos[0]?.Empresa;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="barra-ios px-4 pb-2">
        <div className="flex items-center gap-3">
          <Logo className="h-7 w-7 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-[11px] text-gris">{empresa ?? "InventX"}</p>
            <p className="truncate text-[15px] font-semibold leading-tight">Hola, {sesion.nombre.split(" ")[0]}</p>
          </div>
        </div>
      </header>
      <section className="px-4 pb-2 pt-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-texto">¿Desde qué caja va a vender?</h1>
        <p className="mt-1 text-[15px] text-gris">Las ventas usarán la serie y el secuencial de esa caja.</p>
      </section>

      <div className="flex-1 px-4 py-5">
        {puntos.length === 0 ? (
          <p className="flex items-start gap-3 rounded-lg border border-aviso/30 bg-aviso/10 p-4 text-sm text-texto">
            <Storefront size={24} className="shrink-0 text-aviso" />
            Su sucursal no tiene puntos de venta configurados. Créelos desde InventX escritorio.
          </p>
        ) : (
          <ul className="space-y-3">
            {puntos.map((p) => (
              <li key={p.IDPuntoAcceso}>
                <form action={seleccionarPunto}>
                  <input type="hidden" name="idPuntoAcceso" value={p.IDPuntoAcceso} />
                  <button className="group flex w-full items-center gap-4 rounded-lg border border-borde bg-white p-4 text-left shadow-sm transition hover:border-marca active:scale-[.99]">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-marca/10 text-marca-oscuro">
                      <CashRegister size={28} weight="duotone" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-texto">{p.Descripcion}</span>
                      <span className="num block text-sm text-gris">
                        {p.Sucursal} · Serie {serieDe(p)}
                      </span>
                      <span
                        className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          p.SRIAmbienteProduccion ? "bg-exito/10 text-exito" : "bg-aviso/15 text-[#b45309]"
                        }`}
                      >
                        {p.SRIAmbienteProduccion ? <Broadcast size={12} weight="bold" /> : <Flask size={12} weight="bold" />}
                        SRI {p.SRIAmbienteProduccion ? "producción" : "pruebas"}
                        {p.EsWeb ? " · punto web" : ""}
                      </span>
                    </span>
                    <CaretRight size={20} className="text-gris transition group-hover:translate-x-0.5 group-hover:text-marca" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form action={salir} className="pb-seguro px-4">
        <button className="btn-secundario w-full">
          <SignOut size={20} /> Cerrar sesión
        </button>
      </form>
    </main>
  );
}
