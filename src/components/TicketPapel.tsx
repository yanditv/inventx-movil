import type { Ticket } from "@/lib/ticket";

// Reproduce el ticket de 80 mm de InventX escritorio:
// HeaderTicket + TicketComprobanteVenta / TicketFactura + FooterTicket.

const usd = (n: number) => `$${n.toFixed(2)}`;
const cant = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

function fechaLarga(iso: string) {
  const d = new Date(iso);
  const f = d.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const h = d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${f} ${h}`;
}

export default function TicketPapel({ t }: { t: Ticket }) {
  return (
    <article
      id="ticket"
      className="ticket-papel relative mx-auto w-full max-w-[340px] bg-white px-4 pb-6 pt-5 font-[Arial,Helvetica,sans-serif] text-[12px] leading-snug text-black shadow-md"
    >
      {t.anulada && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="-rotate-[25deg] rounded border-4 border-peligro/60 px-4 py-1 text-4xl font-black tracking-widest text-peligro/60">
            ANULADA
          </span>
        </div>
      )}

      <header className="flex flex-col items-center gap-1 text-center">
        {t.empresa.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.empresa.logo} alt="" className="mb-1 max-h-16 max-w-[60%] object-contain" />
        )}
        <p className="text-[14px] font-bold uppercase">{t.empresa.nombreComercial}</p>
        {t.empresa.razonSocial && <p className="uppercase">{t.empresa.razonSocial}</p>}
        <p className="mt-1 text-[13px] font-bold">{t.titulo}</p>
      </header>

      <hr className="my-2 border-dashed border-black/40" />

      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <dt className="font-bold">Fecha Emisión:</dt>
        <dd className="first-letter:uppercase">{fechaLarga(t.fechaEmision)}</dd>
        <dt className="font-bold">Cliente:</dt>
        <dd className="uppercase">{t.cliente.nombres}</dd>
        <dt className="font-bold">Nro. Identificación:</dt>
        <dd>{t.cliente.identificacion}</dd>
        {t.cliente.direccion && (
          <>
            <dt className="font-bold">Dirección:</dt>
            <dd className="uppercase">{t.cliente.direccion}</dd>
          </>
        )}
      </dl>

      <table className="mt-2 w-full border-collapse tabular-nums">
        <thead>
          <tr className="border-y border-dashed border-black/40 text-left">
            <th className="py-1 pr-1 font-bold">Cant.</th>
            <th className="py-1 pr-1 font-bold">Descripción</th>
            <th className="py-1 pr-1 text-right font-bold">P. Unit</th>
            <th className="py-1 text-right font-bold">Total</th>
          </tr>
        </thead>
        <tbody>
          {t.lineas.map((l, i) => (
            <tr key={i} className="align-top">
              <td className="py-0.5 pr-1">{cant(l.cantidad)}</td>
              <td className="py-0.5 pr-1 uppercase">{l.descripcion}</td>
              <td className="py-0.5 pr-1 text-right">{usd(l.precioUSinIva)}</td>
              <td className="py-0.5 text-right">{usd(l.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr className="my-2 border-dashed border-black/40" />

      <dl className="ml-auto grid w-fit grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-right tabular-nums">
        <dt>Subtotal IVA {t.porcentajeIva}%:</dt>
        <dd>{usd(t.subtotalConIVA)}</dd>
        <dt>Subtotal IVA 0%:</dt>
        <dd>{usd(t.subtotalSinIVA)}</dd>
        <dt>Descuento:</dt>
        <dd>{usd(t.totalDescuento)}</dd>
        <dt>IVA {t.porcentajeIva}% Cobrado:</dt>
        <dd>{usd(t.iva)}</dd>
        <dt className="text-[14px] font-bold">TOTAL:</dt>
        <dd className="text-[14px] font-bold">{usd(t.total)}</dd>
      </dl>

      <p className="mt-2 font-bold">SON: {t.totalEnLetras}</p>

      {t.esFactura && t.claveAcceso && (
        <div className="mt-2 text-center">
          <p className="font-bold">Clave de Acceso</p>
          <p className="break-all font-mono text-[10px]">{t.claveAcceso}</p>
        </div>
      )}

      <p className="mt-3 text-center font-bold">¡NO HAY CAMBIOS NI DEVOLUCIONES!</p>

      <hr className="my-2 border-dashed border-black/40" />
      <footer className="text-center">
        <p>Descargue sus facturas en:</p>
        <p className="font-bold">www.progice.com/facturacion</p>
      </footer>
    </article>
  );
}
