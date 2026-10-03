import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowsLeftRight,
  CashRegister,
  Note,
  Plus,
  Receipt,
  ShoppingCartSimple,
  GearSix,
  CaretRight,
  Prohibit,
  FileText,
} from "@phosphor-icons/react/ssr";
import Logo from "@/components/Logo";
import { InstalarApp } from "@/components/pwa";
import { getSesion } from "@/lib/session";
import { getPuntoAcceso, serieDe, ventasDelDia } from "@/lib/ventas";
import { PERMISO, tiene } from "@/lib/seguridad";
import { getParametros, PARAM } from "@/lib/parametros";
import { money, round } from "@/lib/calculos";
import BotonActualizar from "./BotonActualizar";

export default async function VentasPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");
  if (!sesion.idPuntoAcceso) redirect("/punto");
  const [pa, ventas, p] = await Promise.all([
    getPuntoAcceso(sesion.idPuntoAcceso, sesion.idSucursal),
    ventasDelDia(sesion),
    getParametros([PARAM.PREFIJO_FACTURA, PARAM.PREFIJO_NOTA]),
  ]);
  if (!pa) redirect("/punto");
  const verTodas = tiene(sesion, PERMISO.VENTAS_VER_TODAS);
  const puedeVender = tiene(sesion, PERMISO.VENTAS_REGISTRAR);

  const prefFac = p[PARAM.PREFIJO_FACTURA] || "FAC";
  const prefNot = p[PARAM.PREFIJO_NOTA] || "NOT";
  const validas = ventas.filter((v) => !v.Anulada);
  const totalDia = validas.reduce((s, v) => s + round(Number(v.Total), 2), 0);
  const facturas = validas.filter((v) => v.PrefijoCodificacion === prefFac).length;
  const notas = validas.filter((v) => v.PrefijoCodificacion === prefNot).length;
  const fecha = new Date().toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" });
  const hoy = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-32">
      <header className="barra-marca pt-seguro px-4 pb-16 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">
            <Logo className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-white/75">{pa.Empresa}</p>
            <p className="truncate text-sm font-semibold">{sesion.nombre}</p>
          </div>
          <BotonActualizar />
          <Link href="/ajustes" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15" aria-label="Ajustes">
            <GearSix size={20} weight="bold" />
          </Link>
        </div>

        <p className="mt-6 text-sm text-white/75">{hoy}</p>
        <p className="text-xs uppercase tracking-wider text-white/70">Vendido hoy</p>
        <p className="num text-4xl font-bold tracking-tight">{money(totalDia)}</p>
      </header>

      <section className="-mt-10 px-4">
        <div className="grid grid-cols-3 divide-x divide-borde rounded-xl bg-white py-3 shadow-lg shadow-marca-oscuro/10">
          <Dato icono={<Receipt size={20} weight="duotone" className="text-marca" />} valor={facturas} texto="Facturas" />
          <Dato icono={<Note size={20} weight="duotone" className="text-[#8f57e6]" />} valor={notas} texto="Notas" />
          <Dato
            icono={<ShoppingCartSimple size={20} weight="duotone" className="text-exito" />}
            valor={validas.length}
            texto="Total docs."
          />
        </div>

        <Link
          href="/punto"
          className="mt-3 flex items-center gap-3 rounded-lg border border-borde bg-white px-3 py-2.5 text-sm transition hover:border-marca"
        >
          <CashRegister size={22} weight="duotone" className="text-marca-oscuro" />
          <span className="min-w-0 flex-1">
            <span className="font-semibold text-texto">{pa.Descripcion}</span>
            <span className="num text-gris"> · Serie {serieDe(pa)}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-marca">
            <ArrowsLeftRight size={14} weight="bold" /> Cambiar
          </span>
        </Link>
      </section>

      <section className="px-4 pt-6">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-gris">
          {verTodas ? "Ventas de hoy en este punto" : "Mis ventas de hoy"}
        </h2>
        {ventas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-borde px-6 py-10 text-center">
            <FileText size={40} weight="duotone" className="text-marca/60" />
            <p className="font-semibold text-texto">Aún no registra ventas hoy</p>
            <p className="text-sm text-gris">Toque “Nueva venta” para empezar a vender.</p>
          </div>
        ) : (
          <ul className="divide-y divide-borde overflow-hidden rounded-xl border border-borde bg-white">
            {ventas.map((v) => {
              const esFactura = v.PrefijoCodificacion === prefFac;
              return (
                <li key={v.IDVenta}>
                  <Link href={`/ventas/${v.IDVenta}`} className="flex items-center gap-3 px-3 py-3 active:bg-fondo">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        v.Anulada ? "bg-peligro/10 text-peligro" : esFactura ? "bg-marca/10 text-marca" : "bg-[#8f57e6]/10 text-[#8f57e6]"
                      }`}
                    >
                      {v.Anulada ? (
                        <Prohibit size={22} />
                      ) : esFactura ? (
                        <Receipt size={22} weight="duotone" />
                      ) : (
                        <Note size={22} weight="duotone" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-texto">{v.Cliente || "—"}</p>
                      <p className="num truncate text-xs text-gris">
                        {v.PrefijoCodificacion} {v.NroSeriePuntoVenta}-{v.NroSecuencial} ·{" "}
                        {new Date(v.FechaEmision).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}
                        {verTodas && v.Vendedor ? ` · ${v.Vendedor.split(" ")[0]}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`num font-bold ${v.Anulada ? "text-gris line-through" : "text-texto"}`}>
                        {money(round(Number(v.Total), 2))}
                      </p>
                      {v.Anulada && <p className="text-[11px] font-semibold text-peligro">Anulada</p>}
                    </div>
                    <CaretRight size={16} className="shrink-0 text-gris" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-6">
          <InstalarApp variante="oscuro" />
        </div>
      </section>

      {puedeVender && (
        <div className="pb-seguro fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-fondo via-fondo/95 to-transparent px-4 pt-6">
          <Link href="/ventas/nueva" className="btn-primario mx-auto w-full max-w-md py-4 text-lg shadow-lg">
            <Plus size={22} weight="bold" /> Nueva venta
          </Link>
        </div>
      )}
    </main>
  );
}

function Dato({ icono, valor, texto }: { icono: React.ReactNode; valor: number; texto: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      {icono}
      <span className="num text-xl font-bold text-texto">{valor}</span>
      <span className="text-[11px] text-gris">{texto}</span>
    </div>
  );
}
