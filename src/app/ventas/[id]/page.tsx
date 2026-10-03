import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CaretLeft, Plus } from "@phosphor-icons/react/ssr";
import BotonImprimir from "@/components/BotonImprimir";
import TicketPapel from "@/components/TicketPapel";
import { getSesion } from "@/lib/session";
import { getTicket, type Ticket } from "@/lib/ticket";
import { getPuntoAcceso } from "@/lib/ventas";
import AccionesTicket from "./AccionesTicket";

export const metadata = { title: "Ticket · InventX" };

// Texto plano del ticket para compartir por WhatsApp o correo.
function textoCompartir(t: Ticket) {
  const usd = (n: number) => `$${n.toFixed(2)}`;
  return [
    `*${t.empresa.nombreComercial}*`,
    t.titulo,
    `Cliente: ${t.cliente.nombres} (${t.cliente.identificacion})`,
    "",
    ...t.lineas.map((l) => `${l.cantidad} x ${l.descripcion}  ${usd(l.subtotal)}`),
    "",
    `Subtotal IVA ${t.porcentajeIva}%: ${usd(t.subtotalConIVA)}`,
    `Subtotal IVA 0%: ${usd(t.subtotalSinIVA)}`,
    t.totalDescuento > 0 ? `Descuento: ${usd(t.totalDescuento)}` : null,
    `IVA ${t.porcentajeIva}%: ${usd(t.iva)}`,
    `*TOTAL: ${usd(t.total)}*`,
    t.esFactura && t.claveAcceso ? `\nClave de acceso: ${t.claveAcceso}` : null,
  ]
    .filter((x) => x !== null)
    .join("\n");
}

export default async function TicketPage({ params }: PageProps<"/ventas/[id]">) {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");
  if (!sesion.idPuntoAcceso) redirect("/punto");
  const { id } = await params;
  const idVenta = Number(id);
  if (!Number.isSafeInteger(idVenta) || idVenta <= 0) notFound();

  const [t, pa] = await Promise.all([getTicket(sesion, idVenta), getPuntoAcceso(sesion.idPuntoAcceso, sesion.idSucursal)]);
  if (!t) notFound();

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-10">
      <header className="barra-ios px-4 pb-2 print:hidden">
        <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
          <Link href="/ventas" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-marca active:bg-black/5" aria-label="Volver">
            <CaretLeft size={24} weight="bold" />
          </Link>
          <div className="min-w-0 text-center">
            <h1 className="text-[17px] font-semibold leading-tight">Ticket</h1>
            <p className="num truncate text-xs text-gris">{t.titulo}</p>
          </div>
        </div>
      </header>

      <div className="px-4 pt-4">
        <div className="rounded-lg bg-[#e9ecef] py-4 print:bg-white print:p-0">
          <TicketPapel t={t} />
        </div>

        <div className="mt-4 space-y-2 print:hidden">
          {!t.anulada && <BotonImprimir idVenta={t.idVenta} caja={pa?.PuntoImpresion ?? pa?.Descripcion ?? "La caja"} />}
          <AccionesTicket texto={textoCompartir(t)} titulo={t.titulo} />
          <Link href="/ventas/nueva" className="btn-primario w-full">
            <Plus size={20} weight="bold" /> Nueva venta
          </Link>
        </div>
      </div>
    </main>
  );
}
