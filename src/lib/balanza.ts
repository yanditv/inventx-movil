import "server-only";
import { getParametros } from "./parametros";
import { getPool, sql } from "./db";
import { ErrorVenta, type Producto } from "./ventas";

// Igual que Business/Catalogo/BalanzaBO.cs del escritorio.
// Etiqueta EAN-13 de peso variable: [prefijo 2][PLU][valor][verificador], p. ej. 20 00045 01250 8.
// El PLU es el Codigo del producto; el valor es el peso (BALANZA_TIPO=PESO) o el importe (PRECIO).

export type LecturaBalanza = { plu: string; cantidad: number; precioVenta: number };

const IDS = ["BALANZA_ACTIVA", "BALANZA_PREFIJOS", "BALANZA_DIGITOS_PLU", "BALANZA_TIPO", "BALANZA_DECIMALES"];

function digitoVerificadorValido(ean: string) {
  let suma = 0;
  for (let i = 0; i < 12; i++) suma += Number(ean[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (suma % 10)) % 10 === Number(ean[12]);
}

const redondear = (n: number, d: number) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d;

/** null si el codigo no es una etiqueta de balanza; ErrorVenta si lo es pero no se puede usar. */
export async function leerEtiquetaBalanza(codigo: string): Promise<(Producto & { balanza: LecturaBalanza }) | null> {
  codigo = codigo.trim();
  if (!/^\d{13}$/.test(codigo)) return null;
  const p = await getParametros(IDS);
  if ((p.BALANZA_ACTIVA || "1") !== "1") return null;

  const tipo = (p.BALANZA_TIPO || "PESO").toUpperCase() === "PRECIO" ? "PRECIO" : "PESO";
  const prefijos = (p.BALANZA_PREFIJOS || "20,21,22,23,24,25,26,27,28,29").split(/[,; ]+/).filter(Boolean);
  const dig = Number(p.BALANZA_DIGITOS_PLU);
  const digitosPlu = dig >= 3 && dig <= 6 ? dig : 5;
  const dec = Number(p.BALANZA_DECIMALES);
  const decimales = p.BALANZA_DECIMALES && dec >= 0 && dec <= 4 ? dec : tipo === "PRECIO" ? 2 : 3;

  const prefijo = prefijos.find((x) => codigo.startsWith(x));
  if (!prefijo || !digitoVerificadorValido(codigo)) return null;

  const plu = codigo.substr(prefijo.length, digitosPlu);
  const valor = Number(codigo.substring(prefijo.length + digitosPlu, 12)) / 10 ** decimales;

  // El PLU puede estar guardado con o sin ceros a la izquierda: 00174, 0174 o 174.
  const sinCeros = plu.replace(/^0+/, "") || "0";
  const variantes = [...new Set(Array.from({ length: digitosPlu - sinCeros.length + 1 }, (_, i) => sinCeros.padStart(sinCeros.length + i, "0")))];
  const pool = await getPool();
  const req = pool.request().input("plu", sql.VarChar(50), plu);
  const marcadores = variantes.map((v, i) => {
    req.input(`v${i}`, sql.VarChar(50), v);
    return `@v${i}`;
  });
  const r = await req
    .query<Producto>(
      `SELECT TOP 1 p.IDProducto, p.Codigo, p.Descripcion, p.PrecioMinorista, p.PrecioMayorista, p.Stock, p.AplicaIVA,
              LOWER(u.Descripcion) AS Unidad
         FROM dbo.Producto p
         LEFT JOIN dbo.UnidadMedida u ON u.IDUnidadMedida = p.IDUnidadMedida
        WHERE p.Activo = 1 AND p.Codigo IN (${marcadores.join(", ")})
        ORDER BY CASE WHEN p.Codigo = @plu THEN 0 ELSE 1 END`
    );
  const prod = r.recordset[0];
  if (!prod) throw new ErrorVenta(`Etiqueta de balanza: no existe un producto activo con el código (PLU) ${plu}`);
  if (!(valor > 0)) throw new ErrorVenta(`Etiqueta de balanza sin peso ni precio: ${codigo}`);

  const precio = Number(prod.PrecioMinorista);
  let lectura: LecturaBalanza;
  if (tipo === "PESO") {
    lectura = { plu, cantidad: redondear(valor, 3), precioVenta: precio };
  } else {
    // La etiqueta trae el importe: se calcula el peso y se ajusta el precio para cobrar exactamente lo impreso.
    if (!(precio > 0)) throw new ErrorVenta(`El producto ${prod.Descripcion} no tiene precio por kg/lb`);
    const cantidad = Math.max(redondear(valor / precio, 3), 0.001);
    lectura = { plu, cantidad, precioVenta: redondear(valor / cantidad, 4) };
  }
  return { ...prod, PrecioMinorista: precio, PrecioMayorista: Number(prod.PrecioMayorista), balanza: lectura };
}

export type ProductoBalanza = { plu: string; descripcion: string; precio: number; unidad: string; aplicaIVA: boolean };

/**
 * Productos que se venden por peso (unidad KG o LB) para cargarlos en la balanza.
 * El PLU es el Codigo del producto: debe ser numerico y caber en BALANZA_DIGITOS_PLU.
 */
export async function productosParaBalanza() {
  const p = await getParametros(IDS);
  const dig = Number(p.BALANZA_DIGITOS_PLU);
  const digitosPlu = dig >= 3 && dig <= 6 ? dig : 5;
  const pool = await getPool();
  const r = await pool.request().query<{ Codigo: string; Descripcion: string; PrecioMinorista: number; Unidad: string; AplicaIVA: boolean }>(
    `SELECT p.Codigo, p.Descripcion, p.PrecioMinorista, u.Descripcion AS Unidad, p.AplicaIVA
       FROM dbo.Producto p
       JOIN dbo.UnidadMedida u ON u.IDUnidadMedida = p.IDUnidadMedida
      WHERE p.Activo = 1 AND UPPER(u.Descripcion) IN ('KG', 'LB')
      ORDER BY p.Descripcion`
  );
  const validos: ProductoBalanza[] = [];
  const invalidos: { codigo: string; descripcion: string }[] = [];
  for (const x of r.recordset) {
    const codigo = x.Codigo.trim();
    const item = {
      plu: codigo.padStart(digitosPlu, "0"),
      descripcion: x.Descripcion.trim(),
      precio: Number(x.PrecioMinorista),
      unidad: x.Unidad.trim().toUpperCase(),
      aplicaIVA: Boolean(x.AplicaIVA),
    };
    if (/^\d+$/.test(codigo) && codigo.length <= digitosPlu && Number(codigo) > 0) validos.push(item);
    else invalidos.push({ codigo, descripcion: item.descripcion });
  }
  return {
    validos,
    invalidos,
    config: {
      tipo: (p.BALANZA_TIPO || "PESO").toUpperCase(),
      prefijos: p.BALANZA_PREFIJOS || "20,21,22,23,24,25,26,27,28,29",
      digitosPlu,
      activa: (p.BALANZA_ACTIVA || "1") === "1",
    },
  };
}
