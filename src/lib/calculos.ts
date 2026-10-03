// Calculo de totales identico a Venta.Partial.cs / VentaDetalleProducto.Partial.cs del escritorio.
// El PrecioVenta incluye IVA; el Descuento se aplica sobre la base imponible.

export type LineaCalculo = {
  cantidad: number;
  precioVenta: number;
  descuento: number;
  aplicaIVA: boolean;
};

export type Totales = {
  subtotalConIVA: number;
  subtotalSinIVA: number;
  descuentoConIVA: number;
  descuentoSinIVA: number;
  totalDescuento: number;
  iva: number;
  /** Total sin redondear (lo que se guarda en Venta.Total). */
  total: number;
  /** Total redondeado a 2 decimales (lo que se cobra). */
  totalAPagar: number;
};

export const round = (n: number, d: number) => {
  const f = 10 ** d;
  return Math.round((n + Number.EPSILON) * f) / f;
};

export function subtotalLinea(l: Omit<LineaCalculo, "aplicaIVA">) {
  return l.precioVenta * l.cantidad - l.descuento;
}

export function calcularTotales(lineas: LineaCalculo[], porcentajeIva: number): Totales {
  const pct = porcentajeIva / 100;
  let subtotalConIVA = 0;
  let subtotalSinIVA = 0;
  let descuentoConIVA = 0;
  let descuentoSinIVA = 0;

  for (const l of lineas) {
    const precioSinIva = l.aplicaIVA ? l.precioVenta / (1 + pct) : l.precioVenta;
    const base = precioSinIva * l.cantidad;
    if (l.aplicaIVA) {
      subtotalConIVA += base;
      descuentoConIVA += l.descuento;
    } else {
      subtotalSinIVA += base;
      descuentoSinIVA += l.descuento;
    }
  }

  subtotalConIVA = round(subtotalConIVA, 4);
  subtotalSinIVA = round(subtotalSinIVA, 4);
  descuentoConIVA = round(descuentoConIVA, 4);
  descuentoSinIVA = round(descuentoSinIVA, 4);
  const totalDescuento = descuentoConIVA + descuentoSinIVA;
  const iva = round((subtotalConIVA - descuentoConIVA) * pct, 4);
  const total = subtotalConIVA + subtotalSinIVA + iva - totalDescuento;

  return {
    subtotalConIVA,
    subtotalSinIVA,
    descuentoConIVA,
    descuentoSinIVA,
    totalDescuento,
    iva,
    total,
    totalAPagar: round(total, 2),
  };
}

export const money = (n: number) =>
  n.toLocaleString("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
