import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LockSimple, WarningCircle } from "@phosphor-icons/react/ssr";
import { getSesion } from "@/lib/session";
import { ErrorVenta, getContextoVenta } from "@/lib/ventas";
import PuntoVenta from "./PuntoVenta";

export default async function NuevaVentaPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");
  if (!sesion.idPuntoAcceso) redirect("/punto");

  let ctx;
  try {
    ctx = await getContextoVenta(sesion);
  } catch (e) {
    if (!(e instanceof ErrorVenta)) throw e;
    return <Aviso titulo="No se puede vender" mensaje={e.message} />;
  }
  if (!ctx.cajaAbierta)
    return (
      <Aviso
        caja
        titulo="La caja no está aperturada"
        mensaje={`Abra ${ctx.punto.Descripcion} desde InventX escritorio (Control de caja) y vuelva a intentarlo.`}
      />
    );
  if (!ctx.consumidorFinal)
    return <Aviso titulo="Falta el consumidor final" mensaje="No existe el cliente del parámetro ClienteDefault." />;

  return <PuntoVenta ctx={ctx} />;
}

function Aviso({ titulo, mensaje, caja = false }: { titulo: string; mensaje: string; caja?: boolean }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-aviso/15 text-aviso">
        {caja ? <LockSimple size={40} weight="duotone" /> : <WarningCircle size={40} weight="duotone" />}
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-texto">{titulo}</h1>
        <p className="text-sm text-gris">{mensaje}</p>
      </div>
      <Link href="/ventas" className="btn-secundario w-full">
        <ArrowLeft size={20} /> Volver
      </Link>
    </main>
  );
}
