import "server-only";
import { getPool, sql } from "./db";
import { getParametros } from "./parametros";
import { PERMISO, tiene } from "./seguridad";
import type { Sesion } from "./session";
import { ErrorVenta, type Producto } from "./ventas";

// Alta rapida de productos desde la venta, cuando el codigo escaneado o buscado no existe.
// Usa los mismos valores por defecto que frmProducto del escritorio: categoria NINGUNA,
// CodigoAuxiliar = Codigo, AplicaIVA segun el parametro APLICARIVADEFAULT, activo.

export type UnidadVenta = "UNIDAD" | "KG" | "LB";

export type NuevoProducto = {
  codigo: string;
  descripcion: string;
  /** Precio de venta al publico, con IVA incluido. */
  precio: number;
  aplicaIVA: boolean;
  unidad: UnidadVenta;
};

export async function ivaPorDefecto() {
  const p = await getParametros(["APLICARIVADEFAULT"]);
  return p.APLICARIVADEFAULT === "1";
}

export async function crearProductoRapido(sesion: Sesion, n: NuevoProducto): Promise<Producto> {
  if (!tiene(sesion, PERMISO.PRODUCTOS)) throw new ErrorVenta("Su rol no tiene permiso para crear productos (Ajustes > Permisos).");
  const codigo = n.codigo.trim();
  const descripcion = n.descripcion.trim().toUpperCase();
  const precio = Math.round(Number(n.precio) * 10000) / 10000;
  if (!codigo || codigo.length > 50 || /\s/.test(codigo)) throw new ErrorVenta("Ingrese un código sin espacios (hasta 50 caracteres)");
  if (!descripcion || descripcion.length > 700) throw new ErrorVenta("Ingrese la descripción del producto");
  if (!(precio > 0)) throw new ErrorVenta("Ingrese el precio de venta");
  if (!["UNIDAD", "KG", "LB"].includes(n.unidad)) throw new ErrorVenta("Unidad de medida inválida");

  const pool = await getPool();
  const existe = await pool
    .request()
    .input("c", sql.VarChar(50), codigo)
    .query<{ Descripcion: string; Activo: boolean }>("SELECT TOP 1 Descripcion, Activo FROM dbo.Producto WHERE Codigo = @c");
  const previo = existe.recordset[0];
  if (previo)
    throw new ErrorVenta(
      previo.Activo
        ? `El código ${codigo} ya es de "${previo.Descripcion.trim()}"`
        : `El código ${codigo} pertenece a un producto inactivo ("${previo.Descripcion.trim()}"). Actívelo desde InventX escritorio.`
    );

  const r = await pool
    .request()
    .input("c", sql.VarChar(50), codigo)
    .input("d", sql.VarChar(700), descripcion)
    .input("p", sql.Money, precio)
    .input("iva", sql.Bit, n.aplicaIVA)
    .input("u", sql.VarChar(50), n.unidad)
    .input("e", sql.Int, sesion.idEmpresa)
    .query<Producto>(
      `DECLARE @unidad int = (SELECT TOP 1 IDUnidadMedida FROM dbo.UnidadMedida WHERE UPPER(Descripcion) = @u);
       DECLARE @categoria int = ISNULL((SELECT TOP 1 IDCategoria FROM dbo.Categoria WHERE IDCategoria = 0), (SELECT MIN(IDCategoria) FROM dbo.Categoria));
       INSERT INTO dbo.Producto (Codigo, CodigoAuxiliar, Descripcion, PrecioMayorista, PrecioMinorista, PrecioCompra,
                                 Stock, StockMaximo, StockMinimo, IDCategoria, IDUnidadMedida, AplicaIVA, AplicaICE, IDEmpresa, Activo)
       VALUES (@c, @c, @d, @p, @p, 0, 0, 0, 0, @categoria, ISNULL(@unidad, 0), @iva, 0, @e, 1);
       SELECT p.IDProducto, p.Codigo, p.Descripcion, p.PrecioMinorista, p.PrecioMayorista, p.Stock, p.AplicaIVA,
              LOWER(u.Descripcion) AS Unidad
         FROM dbo.Producto p
         LEFT JOIN dbo.UnidadMedida u ON u.IDUnidadMedida = p.IDUnidadMedida
        WHERE p.IDProducto = CAST(SCOPE_IDENTITY() AS bigint);`
    );
  const x = r.recordset[0];
  return { ...x, PrecioMinorista: Number(x.PrecioMinorista), PrecioMayorista: Number(x.PrecioMayorista) };
}
