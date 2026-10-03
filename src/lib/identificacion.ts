// Validacion de identificaciones del Ecuador (codigos de TipoIdentificacion del SRI).
// Se usa en el navegador (aviso mientras se escribe) y en el servidor (al guardar).
//
// Dos niveles:
//  - error: la forma es imposible (largo, letras, provincia inexistente, establecimiento 000). Bloquea.
//  - advertencia: el digito verificador no coincide con el algoritmo clasico (modulo 10 / 11).
//    No bloquea: el SRI emite RUC nuevos que no cumplen ese algoritmo y aun asi son validos.

export const TIPO = { RUC: "04", CEDULA: "05", PASAPORTE: "06", CONSUMIDOR_FINAL: "07", EXTERIOR: "08", PLACA: "09" } as const;

export type Validacion = { error?: string; advertencia?: string; detalle?: string };

const provinciaValida = (id: string) => {
  const p = Number(id.slice(0, 2));
  return (p >= 1 && p <= 24) || p === 30; // 30: ecuatorianos registrados en el exterior
};

function modulo10(id: string) {
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let v = Number(id[i]) * (i % 2 === 0 ? 2 : 1);
    if (v > 9) v -= 9;
    suma += v;
  }
  return (10 - (suma % 10)) % 10 === Number(id[9]);
}

function modulo11(id: string, coeficientes: number[], posicionVerificador: number) {
  const suma = coeficientes.reduce((s, c, i) => s + c * Number(id[i]), 0);
  const resto = suma % 11;
  const esperado = resto === 0 ? 0 : 11 - resto;
  return esperado === Number(id[posicionVerificador]);
}

const AVISO_DIGITO =
  "El dígito verificador no coincide con el cálculo clásico. Revise que esté bien escrito; si el número es correcto (algunos RUC y cédulas nuevos no cumplen el cálculo), puede guardarlo igual.";

export function validarIdentificacion(numero: string, tipo: string): Validacion {
  const id = numero.trim();
  if (!id) return { error: "Ingrese la identificación" };

  if (tipo === TIPO.CEDULA) {
    if (!/^\d{10}$/.test(id)) return { error: "La cédula debe tener 10 números" };
    if (!provinciaValida(id)) return { error: `La cédula no puede empezar con ${id.slice(0, 2)} (código de provincia inexistente)` };
    if (Number(id[2]) > 5) return { error: "El tercer dígito de una cédula debe estar entre 0 y 5" };
    return modulo10(id) ? { detalle: "Cédula válida" } : { advertencia: AVISO_DIGITO };
  }

  if (tipo === TIPO.RUC) {
    if (!/^\d{13}$/.test(id)) return { error: "El RUC debe tener 13 números" };
    if (!provinciaValida(id)) return { error: `El RUC no puede empezar con ${id.slice(0, 2)} (código de provincia inexistente)` };
    const tercero = Number(id[2]);
    if (tercero <= 5) {
      if (id.endsWith("000")) return { error: "El RUC de persona natural no puede terminar en 000" };
      return modulo10(id) ? { detalle: "RUC de persona natural válido" } : { advertencia: AVISO_DIGITO };
    }
    if (tercero === 6) {
      if (id.endsWith("0000")) return { error: "El RUC de entidad pública no puede terminar en 0000" };
      return modulo11(id, [3, 2, 7, 6, 5, 4, 3, 2], 8) ? { detalle: "RUC de entidad pública válido" } : { advertencia: AVISO_DIGITO };
    }
    if (tercero === 9) {
      if (id.endsWith("000")) return { error: "El RUC de sociedad no puede terminar en 000" };
      return modulo11(id, [4, 3, 2, 7, 6, 5, 4, 3, 2], 9) ? { detalle: "RUC de sociedad válido" } : { advertencia: AVISO_DIGITO };
    }
    return { advertencia: `El tercer dígito (${tercero}) no corresponde a ningún tipo de RUC conocido. Verifique el número.` };
  }

  if (tipo === TIPO.PASAPORTE || tipo === TIPO.EXTERIOR) {
    if (!/^[A-Za-z0-9-]{3,15}$/.test(id)) return { error: "Use de 3 a 15 letras o números, sin espacios" };
    return {};
  }

  if (tipo === TIPO.PLACA) {
    if (!/^[A-Za-z0-9-]{4,15}$/.test(id)) return { error: "Placa inválida" };
    return {};
  }

  if (!/^[A-Za-z0-9-]{3,15}$/.test(id)) return { error: "Identificación inválida" };
  return {};
}

/**
 * Tipo sugerido segun el numero mientras se escribe: solo numeros hasta 10 = cedula (tambien vacio),
 * mas de 10 = RUC (al borrar el 001 vuelve a cedula), con letras = pasaporte.
 */
export function tipoSugerido(numero: string) {
  const id = numero.trim();
  if (/^\d*$/.test(id)) return id.length > 10 ? TIPO.RUC : TIPO.CEDULA;
  return TIPO.PASAPORTE;
}

/** Tipos que se eligen a mano y se respetan aunque el numero cambie (un pasaporte puede ser solo numeros). */
export const esTipoManual = (tipo: string) => tipo === TIPO.PASAPORTE || tipo === TIPO.EXTERIOR || tipo === TIPO.PLACA;
