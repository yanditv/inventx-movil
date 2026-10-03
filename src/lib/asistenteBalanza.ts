import "server-only";
import { AHORA, getPool, sql } from "./db";
import { getParametros } from "./parametros";
import type { Sesion } from "./session";
import { PERMISO, tiene } from "./seguridad";
import { ErrorVenta } from "./ventas";

// Asistente de balanza: encuentra productos que por su nombre parecen venderse por peso
// ("TOMATE LIBRA", "ALAS DE POLLO KG") pero tienen unidad NINGUNA/UNIDAD, y deja que el
// usuario confirme. Nunca cambia nada solo: el nombre no basta ("YOGURT 1Kg" es un envase).

const UNIDAD_KG = 3;
const UNIDAD_LB = 4;

// Palabra de unidad suelta: LB, LBS, LIBRA(S), KG, KGS, KILO(S), KILOGRAMO(S)
const PALABRA_UNIDAD = /(?:^|[^A-Z0-9])(LBS?|LIBRAS?|KGS?|KILOS?|KILOGRAMOS?)(?=$|[^A-Z])/i;
// Cantidad pegada a la unidad: "2 LIBRAS", "1.2Kg", "20KG", "1/2 LB" -> es un paquete cerrado
const CANTIDAD_UNIDAD = /\d+(?:[.,/]\d+)?\s*(?:LBS?|LIBRAS?|KGS?|KILOS?|KILOGRAMOS?)(?=$|[^A-Z])/i;
// Codigo de barras de fabrica (EAN-8, UPC-A, EAN-13, GTIN-14)
const CODIGO_FABRICA = /^\d{8}$|^\d{12,14}$/;

export type Candidato = {
  idProducto: number;
  codigo: string;
  descripcion: string;
  precio: number;
  unidadSugerida: "LB" | "KG";
  pluValido: boolean;
  pluSugerido: string | null;
};

async function digitosPlu() {
  const p = await getParametros(["BALANZA_DIGITOS_PLU"]);
  const d = Number(p.BALANZA_DIGITOS_PLU);
  return d >= 3 && d <= 6 ? d : 5;
}

const esPluValido = (codigo: string, digitos: number) => /^\d+$/.test(codigo) && codigo.length <= digitos && Number(codigo) > 0;

/** Numeros de PLU ya usados por cualquier producto (activo o no), sin importar los ceros a la izquierda. */
async function plusUsados(digitos: number) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("d", sql.Int, digitos)
    .query<{ Codigo: string }>(`SELECT Codigo FROM dbo.Producto WHERE Codigo NOT LIKE '%[^0-9]%' AND LEN(Codigo) BETWEEN 1 AND @d`);
  return new Set(r.recordset.map((x) => Number(x.Codigo)));
}

export async function candidatosBalanza(): Promise<Candidato[]> {
  const digitos = await digitosPlu();
  const pool = await getPool();
  const r = await pool
    .request()
    .input("kg", sql.Int, UNIDAD_KG)
    .input("lb", sql.Int, UNIDAD_LB)
    .query<{ IDProducto: number; Codigo: string; Descripcion: string; PrecioMinorista: number }>(
      `SELECT p.IDProducto, p.Codigo, p.Descripcion, p.PrecioMinorista
         FROM dbo.Producto p
        WHERE p.Activo = 1 AND p.IDUnidadMedida NOT IN (@kg, @lb)
          AND (UPPER(p.Descripcion) LIKE '%LB%' OR UPPER(p.Descripcion) LIKE '%LIBRA%'
               OR UPPER(p.Descripcion) LIKE '%KG%' OR UPPER(p.Descripcion) LIKE '%KILO%')
          AND NOT EXISTS (SELECT 1 FROM dbo.BalanzaDescartado d WHERE d.IDProducto = p.IDProducto)
        ORDER BY p.Descripcion`
    );

  const usados = await plusUsados(digitos);
  let siguiente = 1;
  const proximoLibre = () => {
    while (usados.has(siguiente)) siguiente++;
    if (String(siguiente).length > digitos) return null;
    usados.add(siguiente);
    return String(siguiente);
  };

  const candidatos: Candidato[] = [];
  for (const x of r.recordset) {
    const nombre = x.Descripcion.trim();
    const codigo = x.Codigo.trim();
    const unidad = nombre.match(PALABRA_UNIDAD);
    if (!unidad || CANTIDAD_UNIDAD.test(nombre) || CODIGO_FABRICA.test(codigo)) continue;
    const pluValido = esPluValido(codigo, digitos);
    candidatos.push({
      idProducto: Number(x.IDProducto),
      codigo,
      descripcion: nombre,
      precio: Number(x.PrecioMinorista),
      unidadSugerida: /^L/i.test(unidad[1]) ? "LB" : "KG",
      pluValido,
      pluSugerido: pluValido ? null : proximoLibre(),
    });
  }
  return candidatos;
}

export type Decision = { idProducto: number; accion: "LB" | "KG" | "DESCARTAR"; nuevoCodigo?: string };

export async function aplicarDecision(sesion: Sesion, d: Decision) {
  if (!tiene(sesion, PERMISO.PRODUCTOS)) throw new ErrorVenta("Su rol no tiene permiso para modificar productos (Ajustes > Permisos).");
  const idProducto = Number(d.idProducto);
  if (!Number.isSafeInteger(idProducto) || idProducto <= 0) throw new ErrorVenta("Producto invalido");
  const pool = await getPool();

  if (d.accion === "DESCARTAR") {
    await pool
      .request()
      .input("id", sql.BigInt, idProducto)
      .input("emp", sql.BigInt, sesion.idEmpleado)
      .query(
        `IF NOT EXISTS (SELECT 1 FROM dbo.BalanzaDescartado WHERE IDProducto = @id)
           INSERT INTO dbo.BalanzaDescartado (IDProducto, IDEmpleado, Fecha) VALUES (@id, @emp, ${AHORA})`
      );
    return { ok: true };
  }
  if (d.accion !== "LB" && d.accion !== "KG") throw new ErrorVenta("Accion invalida");

  const req = pool
    .request()
    .input("id", sql.BigInt, idProducto)
    .input("u", sql.Int, d.accion === "LB" ? UNIDAD_LB : UNIDAD_KG);
  let cambiarCodigo = "";
  if (d.nuevoCodigo) {
    const digitos = await digitosPlu();
    const codigo = d.nuevoCodigo.trim();
    if (!esPluValido(codigo, digitos)) throw new ErrorVenta(`El PLU debe ser numérico de hasta ${digitos} dígitos`);
    if ((await plusUsados(digitos)).has(Number(codigo))) throw new ErrorVenta(`El PLU ${codigo} ya lo usa otro producto`);
    req.input("codigo", sql.VarChar(50), codigo);
    cambiarCodigo = ", Codigo = @codigo";
  }
  const r = await req.query(`UPDATE dbo.Producto SET IDUnidadMedida = @u${cambiarCodigo} WHERE IDProducto = @id AND Activo = 1`);
  if (!r.rowsAffected[0]) throw new ErrorVenta("El producto ya no existe o está inactivo");
  return { ok: true };
}
