// Port de UI/Common/Conversores.cs (MonedaALetras / NumeroALetras) del escritorio,
// para que el "SON:" del ticket diga exactamente lo mismo.

function numeroALetras(valor: number): string {
  const v = Math.trunc(valor);
  const unidades = ["CERO", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE"];
  const decenas: Record<number, string> = { 30: "TREINTA", 40: "CUARENTA", 50: "CINCUENTA", 60: "SESENTA", 70: "SETENTA", 80: "OCHENTA", 90: "NOVENTA" };

  if (v <= 15) return unidades[v];
  if (v < 20) return "DIECI" + numeroALetras(v - 10);
  if (v === 20) return "VEINTE";
  if (v < 30) return "VEINTI" + numeroALetras(v - 20);
  if (decenas[v]) return decenas[v];
  if (v < 100) return numeroALetras(Math.trunc(v / 10) * 10) + " Y " + numeroALetras(v % 10);
  if (v === 100) return "CIEN";
  if (v < 200) return "CIENTO " + numeroALetras(v - 100);
  if ([200, 300, 400, 600, 800].includes(v)) return numeroALetras(Math.trunc(v / 100)) + "CIENTOS";
  if (v === 500) return "QUINIENTOS";
  if (v === 700) return "SETECIENTOS";
  if (v === 900) return "NOVECIENTOS";
  if (v < 1000) return numeroALetras(Math.trunc(v / 100) * 100) + " " + numeroALetras(v % 100);
  if (v === 1000) return "MIL";
  if (v < 2000) return "MIL " + numeroALetras(v % 1000);
  if (v < 1_000_000) {
    let t = numeroALetras(Math.trunc(v / 1000)) + " MIL";
    if (v % 1000 > 0) t += " " + numeroALetras(v % 1000);
    return t;
  }
  if (v === 1_000_000) return "UN MILLON";
  if (v < 2_000_000) return "UN MILLON " + numeroALetras(v % 1_000_000);
  let t = numeroALetras(Math.trunc(v / 1_000_000)) + " MILLONES ";
  const resto = v - Math.trunc(v / 1_000_000) * 1_000_000;
  if (resto > 0) t += " " + numeroALetras(resto);
  return t;
}

export function montoEnLetras(monto: number): string {
  const entero = Math.trunc(monto);
  const decimales = Math.round((monto - entero) * 100);
  let moneda = "DOLARES";
  if (entero === 1) moneda = "UN DOLAR";
  if (entero === 0) moneda = "";
  let centavos = "";
  if (decimales > 0) centavos = (entero > 0 ? " CON " : "") + numeroALetras(decimales) + " CENTAVOS";
  const dec = decimales > 0 ? ` ${moneda} ${centavos}` : ` ${moneda}${centavos}`;
  const texto = entero === 0 || entero === 1 ? dec : numeroALetras(entero) + dec;
  return texto.replace(/\s+/g, " ").trim();
}
