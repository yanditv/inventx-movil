import "server-only";
import { getPool, sql } from "./db";
import { calcularTotales, round } from "./calculos";
import { montoEnLetras } from "./letras";
import { getParametros, PARAM } from "./parametros";
import type { Sesion } from "./session";
import { PERMISO, tiene } from "./seguridad";

// Datos del ticket con los mismos campos que TicketComprobanteVenta / TicketFactura
// (Reportes/Transacciones) y HeaderTicket / FooterTicket del escritorio.

export type Ticket = {
  idVenta: number;
  titulo: string; // "NOTA DE VENTA NRO. 001-102-000000001"
  esFactura: boolean;
  anulada: boolean;
  empresa: { nombreComercial: string; razonSocial: string; ruc: string; logo: string | null };
  fechaEmision: string;
  cliente: { nombres: string; identificacion: string; direccion: string; correo: string };
  lineas: { cantidad: number; descripcion: string; precioUSinIva: number; subtotal: number }[];
  porcentajeIva: number;
  subtotalConIVA: number;
  subtotalSinIVA: number;
  totalDescuento: number;
  iva: number;
  total: number;
  totalEnLetras: string;
  claveAcceso: string;
  observaciones: string;
  pago: { efectivo: number; deposito: number; credito: number; recibido: number; vuelto: number } | null;
  vendedor: string;
};

const TITULOS: Record<string, string> = { factura: "FACTURA", nota: "NOTA DE VENTA", proforma: "PROFORMA" };

export async function getTicket(sesion: Sesion, idVenta: number): Promise<Ticket | null> {
  if (!sesion.idPuntoAcceso) return null;
  const pool = await getPool();
  const cab = await pool
    .request()
    .input("v", sql.BigInt, idVenta)
    .input("p", sql.Int, sesion.idPuntoAcceso)
    .input("s", sql.Int, sesion.idSucursal)
    .input("emp", sql.BigInt, sesion.idEmpleado)
    .input("todas", sql.Bit, tiene(sesion, PERMISO.VENTAS_VER_TODAS))
    .query<{
      IDVenta: number;
      PrefijoCodificacion: string;
      NroSeriePuntoVenta: string;
      NroSecuencial: string;
      FechaEmision: Date;
      PorcentajeIva: number;
      Anulada: boolean;
      ClaveAcceso: string;
      Observaciones: string;
      Nombres: string;
      Apellidos: string;
      NroIDentificacion: string;
      Direccion: string;
      Correo: string;
      NombreComercial: string;
      RazonSocial: string;
      Ruc: string;
      Logo: Buffer | null;
      Efectivo: number | null;
      Deposito: number | null;
      Credito: number | null;
      Recibido: number | null;
      Vuelto: number | null;
      Vendedor: string;
    }>(
      `SELECT v.IDVenta, v.PrefijoCodificacion, v.NroSeriePuntoVenta, v.NroSecuencial, v.FechaEmision, v.PorcentajeIva,
              v.Anulada, v.ClaveAcceso, v.Observaciones,
              c.Nombres, c.Apellidos, c.NroIDentificacion, c.Direccion, c.Correo,
              e.NombreComercial, e.RazonSocial, e.NroIdentificacion AS Ruc, e.Logo,
              pg.Efectivo, pg.Deposito, pg.Credito, pg.Recibido, pg.Vuelto,
              LTRIM(RTRIM(em.Nombres + ' ' + em.Apellidos)) AS Vendedor
         FROM dbo.Venta v
         JOIN dbo.Cliente c ON c.IDCliente = v.IDCliente
         JOIN dbo.Sucursal s ON s.IDSucursal = v.IDSucursal
         JOIN dbo.Empresa e ON e.IDEmpresa = s.IDEmpresa
         JOIN dbo.Empleado em ON em.IDEmpleado = v.IDEmpleado
         LEFT JOIN dbo.Pago pg ON pg.IDPago = v.IDPago
        WHERE v.IDVenta = @v AND v.IDPuntoVenta = @p AND v.IDSucursal = @s AND (@todas = 1 OR v.IDEmpleado = @emp)`
    );
  const v = cab.recordset[0];
  if (!v) return null;

  const det = await pool
    .request()
    .input("v", sql.BigInt, idVenta)
    .input("p", sql.Int, sesion.idPuntoAcceso)
    .input("s", sql.Int, sesion.idSucursal)
    .query<{ Cantidad: number; PrecioVenta: number; Descuento: number; Descripcion: string; AplicaIVA: boolean }>(
      `SELECT d.Cantidad, d.PrecioVenta, d.Descuento, p.Descripcion, p.AplicaIVA
         FROM dbo.VentaDetalleProducto d
         JOIN dbo.Producto p ON p.IDProducto = d.IDProducto
        WHERE d.IDVenta = @v AND d.IDPuntoVenta = @p AND d.IDSucursal = @s
        ORDER BY d.NroLinea`
    );

  const pct = Number(v.PorcentajeIva) / 100;
  const lineas = det.recordset.map((d) => {
    const precioVenta = Number(d.PrecioVenta);
    const precioUSinIva = d.AplicaIVA ? precioVenta / (1 + pct) : precioVenta;
    return {
      cantidad: Number(d.Cantidad),
      descripcion: d.Descripcion?.trim() ?? "",
      precioUSinIva,
      subtotal: precioUSinIva * Number(d.Cantidad) - Number(d.Descuento),
      calc: { cantidad: Number(d.Cantidad), precioVenta, descuento: Number(d.Descuento), aplicaIVA: Boolean(d.AplicaIVA) },
    };
  });
  const t = calcularTotales(lineas.map((l) => l.calc), Number(v.PorcentajeIva));

  const prefijos = await getParametros([PARAM.PREFIJO_FACTURA, PARAM.PREFIJO_NOTA, "PrefijoCodificacionProformas"]);
  const tipo =
    v.PrefijoCodificacion === (prefijos[PARAM.PREFIJO_FACTURA] || "FAC")
      ? "factura"
      : v.PrefijoCodificacion === (prefijos[PARAM.PREFIJO_NOTA] || "NOT")
        ? "nota"
        : "proforma";

  return {
    idVenta: Number(v.IDVenta),
    titulo: `${TITULOS[tipo]} NRO. ${v.NroSeriePuntoVenta}-${v.NroSecuencial}`,
    esFactura: tipo === "factura",
    anulada: Boolean(v.Anulada),
    empresa: {
      nombreComercial: v.NombreComercial?.trim() ?? "",
      razonSocial: v.RazonSocial?.trim() ?? "",
      ruc: v.Ruc?.trim() ?? "",
      logo: imagenDataUrl(v.Logo),
    },
    fechaEmision: new Date(v.FechaEmision).toISOString(),
    cliente: {
      nombres: (v.Apellidos?.trim() ? `${v.Apellidos.trim()} ${v.Nombres?.trim() ?? ""}` : v.Nombres?.trim() ?? "").trim(),
      identificacion: v.NroIDentificacion?.trim() ?? "",
      direccion: v.Direccion?.trim() ?? "",
      correo: v.Correo?.trim() ?? "",
    },
    lineas: lineas.map((l) => ({ cantidad: l.cantidad, descripcion: l.descripcion, precioUSinIva: l.precioUSinIva, subtotal: l.subtotal })),
    porcentajeIva: Number(v.PorcentajeIva),
    subtotalConIVA: t.subtotalConIVA,
    subtotalSinIVA: t.subtotalSinIVA,
    totalDescuento: t.totalDescuento,
    iva: t.iva,
    total: t.totalAPagar,
    totalEnLetras: montoEnLetras(t.totalAPagar),
    claveAcceso: v.ClaveAcceso?.trim() ?? "",
    observaciones: v.Observaciones?.trim() ?? "",
    pago:
      v.Efectivo == null
        ? null
        : {
            efectivo: round(Number(v.Efectivo), 2),
            deposito: round(Number(v.Deposito), 2),
            credito: round(Number(v.Credito), 2),
            recibido: round(Number(v.Recibido), 2),
            vuelto: round(Number(v.Vuelto), 2),
          },
    vendedor: v.Vendedor,
  };
}

// El logo se guarda como bytes (PNG o JPG); se detecta el tipo por la firma del archivo.
function imagenDataUrl(bytes: Buffer | null) {
  if (!bytes || !bytes.length) return null;
  const b = Buffer.from(bytes);
  const tipo = b[0] === 0xff && b[1] === 0xd8 ? "image/jpeg" : b[0] === 0x47 && b[1] === 0x49 ? "image/gif" : b[0] === 0x42 && b[1] === 0x4d ? "image/bmp" : "image/png";
  return `data:${tipo};base64,${b.toString("base64")}`;
}
