import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CaretLeft,
  CaretRight,
  CashRegister,
  CheckCircle,
  Desktop,
  Info,
  Printer,
  Scales,
  DownloadSimple,
  MagicWand,
  SignOut,
  WarningCircle,
} from "@phosphor-icons/react/ssr";
import { InstalarApp } from "@/components/pwa";
import { infoImpresoraCaja } from "@/lib/impresion";
import { productosParaBalanza } from "@/lib/balanza";
import { candidatosBalanza } from "@/lib/asistenteBalanza";
import { getSesion } from "@/lib/session";
import { getPuntoAcceso, serieDe } from "@/lib/ventas";
import { salir } from "../acciones";
import InterruptorImpresion from "./InterruptorImpresion";

export const metadata = { title: "Ajustes · InventX" };

function haceCuanto(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString("es-EC", { day: "numeric", month: "short" });
}

export default async function AjustesPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");
  if (!sesion.idPuntoAcceso) redirect("/punto");
  const [pa, info, balanza, candidatos] = await Promise.all([
    getPuntoAcceso(sesion.idPuntoAcceso, sesion.idSucursal),
    infoImpresoraCaja(sesion),
    productosParaBalanza(),
    candidatosBalanza(),
  ]);
  if (!pa) redirect("/punto");

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-10">
      <header className="barra-ios px-4 pb-2">
        <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
          <Link href="/ventas" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-marca active:bg-black/5" aria-label="Volver">
            <CaretLeft size={24} weight="bold" />
          </Link>
          <h1 className="text-center text-[17px] font-semibold leading-tight">Ajustes</h1>
        </div>
      </header>

      <div className="space-y-6 px-4 pt-5">
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-gris">Impresión de tickets</h2>
          <div className="divide-y divide-borde overflow-hidden rounded-xl border border-borde bg-white">
            <InterruptorImpresion />
            <div className="flex items-start gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fondo text-marca-oscuro">
                <Desktop size={24} weight="duotone" />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold text-texto">Impresora de {info.caja ?? pa.Descripcion}</p>
                {info.impresora ? (
                  <p className="text-gris">{info.impresora}</p>
                ) : (
                  <p className="flex items-center gap-1 text-peligro">
                    <WarningCircle size={16} weight="fill" /> {pa.EsWeb && !pa.IDPuntoImpresion ? "Este punto web no tiene caja de impresión (Ajustes > Puntos web en el escritorio)" : "Sin impresora de ticket configurada"}
                  </p>
                )}
                {info.ultimoProceso && (
                  <p className={`mt-1 flex items-center gap-1 text-xs ${info.ultimoEstado === "IMPRESO" ? "text-exito" : "text-peligro"}`}>
                    {info.ultimoEstado === "IMPRESO" ? <CheckCircle size={14} weight="fill" /> : <WarningCircle size={14} weight="fill" />}
                    Último ticket {info.ultimoEstado === "IMPRESO" ? "impreso" : "con error"} {haceCuanto(info.ultimoProceso)}
                    {info.ultimoEstado !== "IMPRESO" && info.ultimoMensaje ? `: ${info.ultimoMensaje}` : ""}
                  </p>
                )}
              </div>
            </div>
          </div>
          <p className="mt-2 flex gap-2 px-1 text-xs leading-relaxed text-gris">
            <Info size={16} className="mt-px shrink-0" />
            Los tickets se imprimen en la caja a través de InventX escritorio, que debe estar abierto en esa computadora. Este ajuste
            se guarda solo en este celular: actívelo en el local y desactívelo cuando venda fuera.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-gris">Balanza de etiquetas</h2>
          <div className="divide-y divide-borde overflow-hidden rounded-xl border border-borde bg-white">
            <div className="flex items-start gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-marca/10 text-marca">
                <Scales size={24} weight="duotone" />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold text-texto">
                  {balanza.validos.length} {balanza.validos.length === 1 ? "producto" : "productos"} por peso (kg o lb)
                </p>
                <p className="num text-gris">
                  Etiqueta con {balanza.config.tipo === "PRECIO" ? "precio" : "peso"} · PLU de {balanza.config.digitosPlu} dígitos ·
                  prefijos {balanza.config.prefijos.split(",")[0]}–{balanza.config.prefijos.split(",").at(-1)}
                </p>
                {!balanza.config.activa && <p className="mt-1 text-peligro">La lectura de etiquetas está desactivada (BALANZA_ACTIVA).</p>}
              </div>
            </div>
            {balanza.invalidos.length > 0 && (
              <div className="flex items-start gap-2 bg-aviso/10 p-4 text-sm text-[#92400e]">
                <WarningCircle size={18} weight="fill" className="mt-px shrink-0" />
                <p>
                  {balanza.invalidos.length} {balanza.invalidos.length === 1 ? "producto tiene" : "productos tienen"} un código que no sirve como
                  PLU (debe ser numérico de hasta {balanza.config.digitosPlu} dígitos):{" "}
                  {balanza.invalidos
                    .slice(0, 3)
                    .map((x) => x.descripcion)
                    .join(", ")}
                  {balanza.invalidos.length > 3 && "…"}
                </p>
              </div>
            )}
            <Link href="/ajustes/balanza" className="flex items-center gap-3 p-4 active:bg-fondo">
              <MagicWand size={22} weight="duotone" className="text-marca" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-texto">Revisar productos sugeridos</span>
                <span className="block text-sm text-gris">Nombres con “libra” o “kilo” que aún no están configurados</span>
              </span>
              {candidatos.length > 0 && (
                <span className="rounded-full bg-aviso px-2 py-0.5 text-xs font-bold text-white">{candidatos.length}</span>
              )}
              <CaretRight size={18} className="text-gris" />
            </Link>
            <a href="/api/balanza/plu" download className="flex items-center gap-3 p-4 font-semibold text-marca active:bg-fondo">
              <DownloadSimple size={22} weight="bold" />
              <span className="flex-1">Exportar productos para la balanza (CSV)</span>
              <CaretRight size={18} className="text-gris" />
            </a>
          </div>
          <p className="mt-2 flex gap-2 px-1 text-xs leading-relaxed text-gris">
            <Info size={16} className="mt-px shrink-0" />
            Importe este archivo en el programa de la balanza cada vez que cambie un precio. En caja, la etiqueta se escanea como
            cualquier código y trae el producto con su peso.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-gris">Sesión</h2>
          <div className="divide-y divide-borde overflow-hidden rounded-xl border border-borde bg-white">
            <Link href="/punto" className="flex items-center gap-3 p-4 active:bg-fondo">
              <CashRegister size={24} weight="duotone" className="text-marca-oscuro" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-texto">{pa.Descripcion}</span>
                <span className="num block text-sm text-gris">Serie {serieDe(pa)} · cambiar caja</span>
              </span>
              <CaretRight size={18} className="text-gris" />
            </Link>
            <form action={salir}>
              <button className="flex w-full items-center gap-3 p-4 text-left text-peligro active:bg-fondo">
                <SignOut size={24} />
                <span className="font-semibold">Cerrar sesión de {sesion.nombre.split(" ")[0]}</span>
              </button>
            </form>
          </div>
        </section>

        <InstalarApp variante="oscuro" />
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-gris">
          <Printer size={14} /> InventX Ventas · {pa.Empresa}
        </p>
      </div>
    </main>
  );
}
