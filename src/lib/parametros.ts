import "server-only";
import { getPool, sql } from "./db";

// Equivalente a GestorAppBO.getValorParametroByID del escritorio.
export async function getParametros(ids: string[]): Promise<Record<string, string | undefined>> {
  const pool = await getPool();
  const req = pool.request();
  const nombres = ids.map((id, i) => {
    req.input(`p${i}`, sql.VarChar(50), id);
    return `@p${i}`;
  });
  const r = await req.query<{ IDParametro: string; ValorParametro: string }>(
    `SELECT IDParametro, ValorParametro FROM dbo.Parametro WHERE IDParametro IN (${nombres.join(",")})`
  );
  const out: Record<string, string | undefined> = {};
  for (const row of r.recordset) out[row.IDParametro] = row.ValorParametro?.trim();
  return out;
}

export const PARAM = {
  IVA: "IVA",
  CLIENTE_DEFAULT: "ClienteDefault",
  PREFIJO_FACTURA: "PrefijoCodificacionFacturas",
  PREFIJO_NOTA: "PrefijoCodificacionNotaVentas",
  CONTROL_CAJA: "CONTROLCAJA",
  LIMITE_CF: "LimitAmoutDefault",
  COBRO_EFECTIVO: "COBROENEFECTIVO",
  COMPRAS_COMO_GASTOS: "COMPRASCOMOGASTOS",
} as const;
