import "server-only";
import { AHORA, getPool, sql } from "./db";
import { getParametros, PARAM } from "./parametros";
import { calcularTotales, round } from "./calculos";
import type { Sesion } from "./session";

// ---------------------------------------------------------------------------
// Login y punto de acceso
// ---------------------------------------------------------------------------

export type EmpleadoLogin = {
  IDEmpleado: number;
  Nombres: string;
  Apellidos: string;
  Usuario: string;
  IDSucursal: number;
  IDEmpresa: number;
};

// Igual que LoginDAO.getUserLogin: usuario y contrasena se comparan en texto plano.
export async function validarLogin(usuario: string, password: string) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("u", sql.VarChar(50), usuario)
    .input("p", sql.VarChar(50), password)
    .query<EmpleadoLogin>(
      `SELECT TOP 1 IDEmpleado, Nombres, Apellidos, Usuario, IDSucursal, IDEmpresa
         FROM dbo.Empleado
        WHERE Usuario = @u AND [Contraseña] = @p AND Estado = 1`
    );
  return r.recordset[0] ?? null;
}

export type PuntoAccesoInfo = {
  IDPuntoAcceso: number;
  IDSucursal: number;
  IDEmpresa: number;
  Descripcion: string;
  VentaTipoDefault: string;
  SRIAmbienteProduccion: boolean;
  IDCaja: number | null;
  PtoEmision: string | null;
  Establecimiento: string | null;
  Sucursal: string;
  RucEmisor: string;
  Empresa: string;
};

const SELECT_PUNTO = `
  SELECT pa.IDPuntoAcceso, pa.IDSucursal, pa.IDEmpresa, pa.Descripcion, pa.VentaTipoDefault,
         pa.SRIAmbienteProduccion, pa.IDCaja, pa.PtoEmision, s.Establecimiento,
         s.Descripcion AS Sucursal, e.NroIdentificacion AS RucEmisor,
         COALESCE(NULLIF(e.NombreComercial, ''), e.Nombre) AS Empresa
    FROM dbo.PuntoAcceso pa
    JOIN dbo.Sucursal s ON s.IDSucursal = pa.IDSucursal AND s.IDEmpresa = pa.IDEmpresa
    JOIN dbo.Empresa e ON e.IDEmpresa = s.IDEmpresa`;

export async function getPuntosAcceso(idSucursal: number, idEmpresa: number) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("s", sql.Int, idSucursal)
    .input("e", sql.Int, idEmpresa)
    .query<PuntoAccesoInfo>(`${SELECT_PUNTO} WHERE pa.IDSucursal = @s AND pa.IDEmpresa = @e ORDER BY pa.IDPuntoAcceso`);
  return r.recordset;
}

export async function getPuntoAcceso(idPuntoAcceso: number, idSucursal: number) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("p", sql.Int, idPuntoAcceso)
    .input("s", sql.Int, idSucursal)
    .query<PuntoAccesoInfo>(`${SELECT_PUNTO} WHERE pa.IDPuntoAcceso = @p AND pa.IDSucursal = @s`);
  return r.recordset[0] ?? null;
}

// Registra la ultima conexion como hace frmInicio al iniciar sesion.
export async function marcarConexion(idPuntoAcceso: number, idSucursal: number, idEmpleado: number) {
  const pool = await getPool();
  await pool
    .request()
    .input("p", sql.Int, idPuntoAcceso)
    .input("s", sql.Int, idSucursal)
    .input("u", sql.BigInt, idEmpleado)
    .query(
      `UPDATE dbo.PuntoAcceso SET IDUltimoUsuarioConectado = @u, FechaUltimaConexion = ${AHORA}
        WHERE IDPuntoAcceso = @p AND IDSucursal = @s`
    );
}

// Utils.getEstablecimiento / Utils.getPuntoEmision del escritorio.
export function serieDe(pa: PuntoAccesoInfo) {
  const est = pa.Establecimiento?.trim() || String(pa.IDSucursal).padStart(3, "0");
  const pto = pa.PtoEmision?.trim() || String(pa.IDPuntoAcceso).padStart(3, "0");
  return `${est}-${pto}`;
}

// ---------------------------------------------------------------------------
// Contexto de la pantalla de ventas
// ---------------------------------------------------------------------------

export type TipoDocumento = "factura" | "nota";

export type Cliente = {
  IDCliente: number;
  NroIDentificacion: string;
  Nombres: string;
  Apellidos: string;
  Correo: string;
  Telefono: string;
  Direccion: string;
};

export async function getContextoVenta(sesion: Sesion) {
  if (!sesion.idPuntoAcceso) throw new ErrorVenta("Seleccione un punto de acceso");
  const pa = await getPuntoAcceso(sesion.idPuntoAcceso, sesion.idSucursal);
  if (!pa) throw new ErrorVenta("El punto de acceso ya no existe");

  const p = await getParametros(Object.values(PARAM));
  const prefijos = {
    factura: p[PARAM.PREFIJO_FACTURA] || "FAC",
    nota: p[PARAM.PREFIJO_NOTA] || "NOT",
  };
  const tipoDefault: TipoDocumento = pa.VentaTipoDefault?.trim() === prefijos.nota ? "nota" : "factura";
  const consumidorFinal = p[PARAM.CLIENTE_DEFAULT] || "9999999999999";

  const pool = await getPool();
  const cf = await pool
    .request()
    .input("r", sql.VarChar(15), consumidorFinal)
    .query<Cliente>(
      `SELECT TOP 1 IDCliente, NroIDentificacion, Nombres, Apellidos, Correo, Telefono, Direccion
         FROM dbo.Cliente WHERE NroIDentificacion = @r`
    );
  const tipos = await pool
    .request()
    .query<{ IDTipoIdentificacion: string; Descripcion: string }>(
      `SELECT IDTipoIdentificacion, Descripcion FROM dbo.TipoIdentificacion ORDER BY IDTipoIdentificacion`
    );

  return {
    punto: pa,
    serie: serieDe(pa),
    porcentajeIva: Number(p[PARAM.IVA] ?? 15),
    prefijos,
    tipoDefault,
    consumidorFinal: cf.recordset[0] ?? null,
    cobroEnEfectivo: p[PARAM.COBRO_EFECTIVO] === "1",
    limiteConsumidorFinal: Number(p[PARAM.LIMITE_CF] ?? 0) || null,
    tiposIdentificacion: tipos.recordset,
    cajaAbierta: await cajaAbierta(pa, p[PARAM.CONTROL_CAJA] === "1"),
  };
}

export type ContextoVenta = Awaited<ReturnType<typeof getContextoVenta>>;

async function cajaAbierta(pa: PuntoAccesoInfo, controlCaja: boolean) {
  if (!controlCaja) return true;
  if (pa.IDCaja == null) return false;
  const pool = await getPool();
  const r = await pool
    .request()
    .input("c", sql.Int, pa.IDCaja)
    .query<{ CajaAbierta: boolean | number }>(`SELECT TOP 1 CajaAbierta FROM dbo.vw_EstadoCajas WHERE IDCaja = @c`);
  return Boolean(r.recordset[0]?.CajaAbierta);
}

// ---------------------------------------------------------------------------
// Productos y clientes
// ---------------------------------------------------------------------------

export type Producto = {
  IDProducto: number;
  Codigo: string;
  Descripcion: string;
  PrecioMinorista: number;
  PrecioMayorista: number;
  Stock: number;
  AplicaIVA: boolean;
};

// ProductoDAO.getByBarCode + getByFilter: codigo exacto primero, luego coincidencias.
export async function buscarProductos(filtro: string) {
  const p = await getParametros([PARAM.COMPRAS_COMO_GASTOS]);
  const excluirCompras =
    p[PARAM.COMPRAS_COMO_GASTOS] === "1"
      ? "AND NOT EXISTS (SELECT 1 FROM dbo.ComprasDetalleProducto c WHERE c.IDProducto = p.IDProducto)"
      : "";
  const pool = await getPool();
  const r = await pool
    .request()
    .input("q", sql.VarChar(700), filtro)
    .input("like", sql.VarChar(702), `%${escaparLike(filtro)}%`)
    .query<Producto>(
      `SELECT TOP 40 p.IDProducto, p.Codigo, p.Descripcion, p.PrecioMinorista, p.PrecioMayorista,
              p.Stock, p.AplicaIVA
         FROM dbo.Producto p
        WHERE p.Activo = 1 ${excluirCompras}
          AND (p.Codigo = @q OR p.Codigo LIKE @like ESCAPE '\\' OR p.Descripcion LIKE @like ESCAPE '\\')
        ORDER BY CASE WHEN p.Codigo = @q THEN 0 ELSE 1 END, p.Descripcion`
    );
  return r.recordset.map((x) => ({ ...x, PrecioMinorista: Number(x.PrecioMinorista), PrecioMayorista: Number(x.PrecioMayorista) }));
}

// ClienteDAO.getByRUC + getByFiltro.
export async function buscarClientes(filtro: string) {
  const p = await getParametros([PARAM.CLIENTE_DEFAULT]);
  const cf = p[PARAM.CLIENTE_DEFAULT] || "9999999999999";
  const pool = await getPool();
  const r = await pool
    .request()
    .input("q", sql.VarChar(100), filtro)
    .input("like", sql.VarChar(102), `%${escaparLike(filtro)}%`)
    .input("cf", sql.VarChar(15), cf)
    .query<Cliente>(
      `SELECT TOP 30 IDCliente, NroIDentificacion, Nombres, Apellidos, Correo, Telefono, Direccion
         FROM dbo.Cliente
        WHERE Activo = 1 AND NroIDentificacion <> @cf
          AND (NroIDentificacion LIKE @like ESCAPE '\\' OR Nombres LIKE @like ESCAPE '\\' OR Apellidos LIKE @like ESCAPE '\\'
               OR (Apellidos + ' ' + Nombres) LIKE @like ESCAPE '\\' OR (Nombres + ' ' + Apellidos) LIKE @like ESCAPE '\\')
        ORDER BY CASE WHEN NroIDentificacion = @q THEN 0 ELSE 1 END, Apellidos, Nombres`
    );
  return r.recordset;
}

export type NuevoCliente = {
  nroIdentificacion: string;
  idTipoIdentificacion: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  correo: string;
  direccion: string;
};

// Mismos valores por defecto que frmCliente del escritorio.
export async function crearCliente(c: NuevoCliente) {
  const id = c.nroIdentificacion.trim();
  if (!id || id.length > 15) throw new ErrorVenta("Numero de identificacion invalido");
  if (!c.nombres.trim()) throw new ErrorVenta("Ingrese los nombres del cliente");
  if (c.correo && !/^\S+@\S+\.\S+$/.test(c.correo.trim())) throw new ErrorVenta("Correo invalido");

  const pool = await getPool();
  const existe = await pool
    .request()
    .input("r", sql.VarChar(15), id)
    .query(`SELECT 1 FROM dbo.Cliente WHERE NroIDentificacion = @r`);
  if (existe.recordset.length) throw new ErrorVenta("Ya existe un cliente con esa identificacion");

  const corto = (s: string) => s.trim().slice(0, 50);
  const r = await pool
    .request()
    .input("id", sql.VarChar(15), id)
    .input("nom", sql.VarChar(50), corto(c.nombres).toUpperCase())
    .input("ape", sql.VarChar(50), corto(c.apellidos).toUpperCase())
    .input("tel", sql.VarChar(50), corto(c.telefono))
    .input("cor", sql.VarChar(50), corto(c.correo))
    .input("dir", sql.VarChar(50), corto(c.direccion).toUpperCase())
    .input("tipo", sql.VarChar(2), c.idTipoIdentificacion || "05")
    .query<Cliente>(
      `INSERT INTO dbo.Cliente (NroIDentificacion, Nombres, Apellidos, Telefono, Celular, Correo, IDSexo, Direccion,
                                IDCiudad, IDParroquia, FechaRegistro, Descuento, Deuda, Credito,
                                IDTipoIdentificacion, Activo, IsMayorista)
       VALUES (@id, @nom, @ape, @tel, '', @cor, 0, @dir, '0000', '000000', ${AHORA}, 0, 0, 0, @tipo, 1, 0);
       SELECT IDCliente, NroIDentificacion, Nombres, Apellidos, Correo, Telefono, Direccion
         FROM dbo.Cliente WHERE IDCliente = CAST(SCOPE_IDENTITY() AS bigint);`
    );
  return r.recordset[0];
}

// ---------------------------------------------------------------------------
// Registro de la venta
// ---------------------------------------------------------------------------

export class ErrorVenta extends Error {}

export type VentaInput = {
  tipo: TipoDocumento;
  idCliente: number;
  observaciones?: string;
  lineas: { idProducto: number; cantidad: number; precioVenta: number; descuento: number }[];
  pago: { efectivo: number; deposito: number; recibido: number };
};

/**
 * Replica VentaDAO.Add del escritorio en una sola transaccion:
 * Pago -> Venta (el trigger createDocumentoElectronicoVenta genera la clave de acceso
 * y el DocumentoElectronico para facturas) -> VentaDetalleProducto.
 * Como en el escritorio, no se descuenta stock ni se registra movimiento de caja.
 */
export async function registrarVenta(sesion: Sesion, input: VentaInput) {
  const ctx = await getContextoVenta(sesion);
  if (!ctx.cajaAbierta) throw new ErrorVenta("La caja no esta aperturada");
  if (input.tipo !== "factura" && input.tipo !== "nota") throw new ErrorVenta("Tipo de documento invalido");
  if (!input.lineas?.length) throw new ErrorVenta("Agregue al menos un producto");
  if (input.lineas.length > 500) throw new ErrorVenta("Demasiadas lineas");

  const pool = await getPool();

  // Cliente
  const cli = await pool
    .request()
    .input("c", sql.BigInt, input.idCliente)
    .query<{ IDCliente: number; NroIDentificacion: string }>(
      `SELECT IDCliente, NroIDentificacion FROM dbo.Cliente WHERE IDCliente = @c`
    );
  const cliente = cli.recordset[0];
  if (!cliente) throw new ErrorVenta("Seleccione un cliente");
  const esConsumidorFinal = cliente.NroIDentificacion === ctx.consumidorFinal?.NroIDentificacion;

  // Productos: AplicaIVA siempre se toma de la base, no del cliente.
  const ids = [...new Set(input.lineas.map((l) => Number(l.idProducto)))];
  if (ids.some((x) => !Number.isSafeInteger(x))) throw new ErrorVenta("Producto invalido");
  const prodReq = pool.request();
  const marcadores = ids.map((id, i) => {
    prodReq.input(`id${i}`, sql.BigInt, id);
    return `@id${i}`;
  });
  const prods = await prodReq.query<{ IDProducto: number; AplicaIVA: boolean }>(
    `SELECT IDProducto, AplicaIVA FROM dbo.Producto WHERE Activo = 1 AND IDProducto IN (${marcadores.join(",")})`
  );
  const aplicaIva = new Map(prods.recordset.map((p) => [Number(p.IDProducto), Boolean(p.AplicaIVA)]));

  const lineas = input.lineas.map((l) => {
    const cantidad = Number(l.cantidad);
    const precioVenta = round(Number(l.precioVenta), 4);
    const descuento = round(Number(l.descuento) || 0, 4);
    if (!aplicaIva.has(Number(l.idProducto))) throw new ErrorVenta("Hay productos inactivos o inexistentes");
    if (!(cantidad > 0)) throw new ErrorVenta("La cantidad debe ser mayor a cero");
    if (!(precioVenta >= 0)) throw new ErrorVenta("Precio invalido");
    if (descuento < 0 || descuento > precioVenta * cantidad) throw new ErrorVenta("Descuento invalido");
    return { idProducto: Number(l.idProducto), cantidad, precioVenta, descuento, aplicaIVA: aplicaIva.get(Number(l.idProducto))! };
  });

  const totales = calcularTotales(lineas, ctx.porcentajeIva);
  if (!(totales.totalAPagar > 0)) throw new ErrorVenta("El total debe ser mayor a cero");
  if (input.tipo === "factura" && esConsumidorFinal && ctx.limiteConsumidorFinal && totales.totalAPagar > ctx.limiteConsumidorFinal) {
    throw new ErrorVenta(`Una factura a consumidor final no puede superar ${ctx.limiteConsumidorFinal.toFixed(2)}`);
  }

  // Pago (frmPago): credito = por cobrar - efectivo - deposito
  const porCobrar = totales.totalAPagar;
  const efectivo = round(Number(input.pago.efectivo) || 0, 2);
  const deposito = round(Number(input.pago.deposito) || 0, 2);
  const recibido = round(Number(input.pago.recibido) || 0, 2);
  const credito = round(porCobrar - efectivo - deposito, 2);
  if (efectivo < 0 || deposito < 0 || recibido < 0) throw new ErrorVenta("Los valores del pago no pueden ser negativos");
  if (credito < 0) throw new ErrorVenta("El pago supera el total a cobrar");
  if (esConsumidorFinal && credito > 0) throw new ErrorVenta("No se puede dar credito a consumidor final");
  if (recibido > 0 && recibido < efectivo) throw new ErrorVenta("El valor recibido es menor al efectivo");
  const vuelto = recibido > 0 ? round(recibido - efectivo, 2) : 0;

  const prefijo = ctx.prefijos[input.tipo];
  const pa = ctx.punto;
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    // Secuencial (GestorAPPDAO.getNextSecuencialSucursalPunto) con bloqueo para evitar duplicados.
    const sec = await new sql.Request(tx)
      .input("s", sql.Int, pa.IDSucursal)
      .input("p", sql.Int, pa.IDPuntoAcceso)
      .input("serie", sql.VarChar(20), ctx.serie)
      .input("pref", sql.VarChar(20), prefijo)
      .input("prod", sql.Bit, pa.SRIAmbienteProduccion)
      .query<{ ultimo: number | null }>(
        `SELECT MAX(CAST(NroSecuencial AS bigint)) AS ultimo
           FROM dbo.Venta WITH (UPDLOCK, HOLDLOCK)
          WHERE Anulada = 0 AND IDSucursal = @s AND IDPuntoVenta = @p AND NroSeriePuntoVenta = @serie
            AND PrefijoCodificacion = @pref AND EbillingProduccion = @prod`
      );
    const nroSecuencial = String(Number(sec.recordset[0]?.ultimo ?? 0) + 1).padStart(9, "0");

    const pago = await new sql.Request(tx)
      .input("efe", sql.Money, efectivo)
      .input("cre", sql.Money, credito)
      .input("dep", sql.Money, deposito)
      .input("pc", sql.Money, porCobrar)
      .input("rec", sql.Money, recibido)
      .input("vue", sql.Money, vuelto)
      .query<{ IDPago: number }>(
        `INSERT INTO dbo.Pago (Efectivo, Credito, Deposito, PorCobrar, Total, Recibido, Vuelto, Fecha, Observaciones)
         VALUES (@efe, @cre, @dep, @pc, 0, @rec, @vue, ${AHORA}, '');
         SELECT CAST(SCOPE_IDENTITY() AS bigint) AS IDPago;`
      );
    const idPago = pago.recordset[0].IDPago;

    const venta = await new sql.Request(tx)
      .input("p", sql.Int, pa.IDPuntoAcceso)
      .input("s", sql.Int, pa.IDSucursal)
      .input("cli", sql.BigInt, cliente.IDCliente)
      .input("pago", sql.BigInt, idPago)
      .input("iva", sql.Float, ctx.porcentajeIva)
      .input("emp", sql.BigInt, sesion.idEmpleado)
      .input("total", sql.Money, totales.total)
      .input("sec", sql.VarChar(20), nroSecuencial)
      .input("serie", sql.VarChar(20), ctx.serie)
      .input("pref", sql.VarChar(20), prefijo)
      .input("obs", sql.VarChar(sql.MAX), (input.observaciones ?? "").trim())
      .input("ruc", sql.VarChar(15), pa.RucEmisor)
      .input("prod", sql.Bit, pa.SRIAmbienteProduccion)
      .query<{ IDVenta: number }>(
        `INSERT INTO dbo.Venta (IDPuntoVenta, IDSucursal, IDCliente, IDPago, FechaEmision, Anulada, PorcentajeIva,
                                Declarado, IDEmpleado, Total, NroSecuencial, NroSeriePuntoVenta, PrefijoCodificacion,
                                ClaveAcceso, Observaciones, RucEmisor, EnviadoEmail, EbillingProduccion, FromProformaNro)
         VALUES (@p, @s, @cli, @pago, ${AHORA}, 0, @iva, 0, @emp, @total, @sec, @serie, @pref,
                 '', @obs, @ruc, 0, @prod, '');
         SELECT CAST(SCOPE_IDENTITY() AS bigint) AS IDVenta;`
      );
    const idVenta = venta.recordset[0].IDVenta;

    const codigoFactura = `${ctx.serie}-${nroSecuencial}`;
    for (const [i, l] of lineas.entries()) {
      await new sql.Request(tx)
        .input("v", sql.BigInt, idVenta)
        .input("prod", sql.BigInt, l.idProducto)
        .input("p", sql.Int, pa.IDPuntoAcceso)
        .input("s", sql.Int, pa.IDSucursal)
        .input("linea", sql.Int, i + 1)
        .input("cant", sql.Float, l.cantidad)
        .input("precio", sql.Money, l.precioVenta)
        .input("desc", sql.Money, l.descuento)
        .input("cod", sql.VarChar(50), codigoFactura)
        .query(
          `INSERT INTO dbo.VentaDetalleProducto (IDVenta, IDProducto, IDPuntoVenta, IDSucursal, NroLinea,
                                                 Cantidad, PrecioVenta, Descuento, Observacion, CodigoFactura)
           VALUES (@v, @prod, @p, @s, @linea, @cant, @precio, @desc, '', @cod)`
        );
    }

    const clave = await new sql.Request(tx)
      .input("v", sql.BigInt, idVenta)
      .input("p", sql.Int, pa.IDPuntoAcceso)
      .input("s", sql.Int, pa.IDSucursal)
      .query<{ ClaveAcceso: string }>(
        `SELECT ClaveAcceso FROM dbo.Venta WHERE IDVenta = @v AND IDPuntoVenta = @p AND IDSucursal = @s`
      );

    await tx.commit();
    return {
      idVenta,
      numero: `${prefijo} ${codigoFactura}`,
      total: totales.totalAPagar,
      vuelto,
      claveAcceso: clave.recordset[0]?.ClaveAcceso ?? "",
    };
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }
}

export async function ventasDelDia(sesion: Sesion) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("emp", sql.BigInt, sesion.idEmpleado)
    .input("s", sql.Int, sesion.idSucursal)
    .input("p", sql.Int, sesion.idPuntoAcceso ?? 0)
    .query<{
      IDVenta: number;
      PrefijoCodificacion: string;
      NroSeriePuntoVenta: string;
      NroSecuencial: string;
      FechaEmision: Date;
      Total: number;
      Anulada: boolean;
      Cliente: string;
      ClaveAcceso: string;
    }>(
      `SELECT TOP 100 v.IDVenta, v.PrefijoCodificacion, v.NroSeriePuntoVenta, v.NroSecuencial, v.FechaEmision,
              v.Total, v.Anulada, v.ClaveAcceso, LTRIM(RTRIM(c.Apellidos + ' ' + c.Nombres)) AS Cliente
         FROM dbo.Venta v
         JOIN dbo.Cliente c ON c.IDCliente = v.IDCliente
        WHERE v.IDEmpleado = @emp AND v.IDSucursal = @s AND v.IDPuntoVenta = @p
          AND v.FechaEmision >= CAST(${AHORA} AS date)
        ORDER BY v.FechaEmision DESC`
    );
  return r.recordset;
}

function escaparLike(s: string) {
  return s.replace(/[\\%_[]/g, (c) => `\\${c}`);
}
