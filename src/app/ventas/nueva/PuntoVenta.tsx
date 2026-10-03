"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bank,
  Barcode,
  CaretDown,
  CaretLeft,
  CheckCircle,
  CircleNotch,
  HandCoins,
  IdentificationCard,
  ListBullets,
  MagnifyingGlass,
  Minus,
  Money,
  Note,
  Package,
  PencilSimple,
  Plus,
  Receipt,
  Tag,
  Trash,
  UserCircle,
  UserPlus,
  Users,
  Wallet,
  WarningCircle,
  WifiSlash,
  X,
} from "@phosphor-icons/react";
import { calcularTotales, money, round, subtotalLinea } from "@/lib/calculos";
import type { Cliente, ContextoVenta, Producto, TipoDocumento } from "@/lib/ventas";
import { useEnLinea } from "@/components/pwa";

type Linea = { producto: Producto; cantidad: number; precioVenta: number; descuento: number };
type Resultado = { numero: string; total: number; vuelto: number; claveAcceso: string };
type Aviso = { texto: string; tipo: "ok" | "aviso" | "error"; id: number };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  if (r.status === 401) {
    // Recarga completa para limpiar el estado al expirar la sesion.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
    throw new Error("Su sesión expiró");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "No se pudo completar la operación");
  return data as T;
}

const nombreCliente = (c: Cliente) => `${c.Apellidos ?? ""} ${c.Nombres ?? ""}`.trim() || c.NroIDentificacion;
const iniciales = (c: Cliente) =>
  nombreCliente(c)
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
const num = (s: string) => (s.trim() === "" ? 0 : Number(s.replace(",", ".")));
const vibrar = (ms = 12) => {
  try {
    navigator.vibrate?.(ms);
  } catch {}
};

export default function PuntoVenta({ ctx }: { ctx: ContextoVenta }) {
  const router = useRouter();
  const enLinea = useEnLinea();
  const cf = ctx.consumidorFinal!;
  const [tipo, setTipo] = useState<TipoDocumento>(ctx.tipoDefault);
  const [cliente, setCliente] = useState<Cliente>(cf);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [hoja, setHoja] = useState<null | "cliente" | "cobro" | "salir" | { editar: number }>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [destacado, setDestacado] = useState<{ id: number; n: number } | null>(null);

  const totales = useMemo(
    () => calcularTotales(lineas.map((l) => ({ ...l, aplicaIVA: l.producto.AplicaIVA })), ctx.porcentajeIva),
    [lineas, ctx.porcentajeIva]
  );
  const esCF = cliente.IDCliente === cf.IDCliente;
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2200);
    return () => clearTimeout(t);
  }, [aviso]);

  const avisar = (texto: string, tipoAviso: Aviso["tipo"] = "ok") => setAviso({ texto, tipo: tipoAviso, id: Date.now() });

  // Venta.AgregarProducto: si ya existe suma 1, si no agrega con PrecioMinorista.
  function agregar(p: Producto) {
    vibrar();
    const existente = lineas.find((l) => l.producto.IDProducto === p.IDProducto);
    setLineas((ls) =>
      existente
        ? ls.map((l) => (l.producto.IDProducto === p.IDProducto ? { ...l, cantidad: l.cantidad + 1 } : l))
        : [...ls, { producto: p, cantidad: 1, precioVenta: Number(p.PrecioMinorista), descuento: 0 }]
    );
    setDestacado({ id: Number(p.IDProducto), n: Date.now() });
    if (p.Stock <= 0) avisar(`${p.Descripcion}: sin stock`, "aviso");
    else avisar(existente ? `+1 ${p.Descripcion}` : `Agregado: ${p.Descripcion}`);
  }

  const actualizar = (i: number, cambios: Partial<Linea>) =>
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...cambios } : l)));
  const quitar = (i: number) => {
    vibrar(20);
    setLineas((ls) => ls.filter((_, j) => j !== i));
  };

  function nueva() {
    setLineas([]);
    setCliente(cf);
    setTipo(ctx.tipoDefault);
    setResultado(null);
    setHoja(null);
    window.scrollTo({ top: 0 });
  }

  if (resultado) return <PantallaExito r={resultado} onNueva={nueva} />;

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-48">
      <header className="barra-marca pt-seguro sticky top-0 z-20 px-4 pb-3 text-white shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => (lineas.length ? setHoja("salir") : router.push("/ventas"))}
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-lg active:bg-white/15"
            aria-label="Volver"
          >
            <CaretLeft size={24} weight="bold" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight">Nueva venta</h1>
            <p className="num truncate text-xs text-white/80">
              {ctx.punto.Descripcion} · {ctx.prefijos[tipo]} {ctx.serie}
            </p>
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">IVA {ctx.porcentajeIva}%</span>
        </div>
        <div role="tablist" className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-black/15 p-1 text-sm font-semibold">
          {(["factura", "nota"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tipo === t}
              onClick={() => setTipo(t)}
              className={`flex items-center justify-center gap-1.5 rounded-md py-2 transition ${
                tipo === t ? "bg-white text-marca-oscuro shadow" : "text-white/85"
              }`}
            >
              {t === "factura" ? <Receipt size={18} weight={tipo === t ? "fill" : "regular"} /> : <Note size={18} weight={tipo === t ? "fill" : "regular"} />}
              {t === "factura" ? "Factura" : "Nota de venta"}
            </button>
          ))}
        </div>
      </header>

      {!enLinea && (
        <div className="flex items-center gap-2 bg-peligro px-4 py-2 text-sm font-medium text-white">
          <WifiSlash size={18} weight="bold" /> Sin conexión. Podrá cobrar cuando vuelva la red.
        </div>
      )}

      <div className="space-y-3 px-4 pt-3">
        <button
          onClick={() => setHoja("cliente")}
          className="flex w-full items-center gap-3 rounded-lg border border-borde bg-white p-3 text-left transition hover:border-marca active:scale-[.99]"
        >
          {esCF ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fondo text-gris">
              <Users size={24} weight="duotone" />
            </span>
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-marca text-sm font-bold text-white">
              {iniciales(cliente)}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-gris">Cliente</span>
            <span className="block truncate font-semibold text-texto">{esCF ? "CONSUMIDOR FINAL" : nombreCliente(cliente)}</span>
            <span className="num block text-xs text-gris">{cliente.NroIDentificacion}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-marca">
            <PencilSimple size={16} weight="bold" /> Cambiar
          </span>
        </button>

        <BuscadorProductos onAgregar={agregar} />

        {lineas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-borde px-6 py-10 text-center">
            <Barcode size={44} weight="duotone" className="text-marca/60" />
            <p className="font-semibold text-texto">Agregue productos a la venta</p>
            <p className="text-sm text-gris">Busque por nombre o código, o use un lector de código de barras.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-1 pt-1">
              <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gris">
                <ListBullets size={16} weight="bold" /> Detalle
              </h2>
              <button onClick={() => setLineas([])} className="text-xs font-semibold text-peligro">
                Vaciar
              </button>
            </div>
            <ul className="space-y-2">
              {lineas.map((l, i) => (
                <li
                  key={`${l.producto.IDProducto}-${destacado?.id === Number(l.producto.IDProducto) ? destacado.n : 0}`}
                  className={`rounded-lg border border-borde bg-white p-3 ${
                    destacado?.id === Number(l.producto.IDProducto) ? "anim-destello" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-marca/10 text-marca">
                      <Package size={20} weight="duotone" />
                    </span>
                    <button className="min-w-0 flex-1 text-left" onClick={() => setHoja({ editar: i })}>
                      <p className="line-clamp-2 text-sm font-semibold leading-snug text-texto">{l.producto.Descripcion}</p>
                      <p className="num mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gris">
                        <span>{money(l.precioVenta)} c/u</span>
                        {!l.producto.AplicaIVA && <span className="font-semibold text-[#8f57e6]">IVA 0%</span>}
                        {l.descuento > 0 && (
                          <span className="inline-flex items-center gap-0.5 font-semibold text-exito">
                            <Tag size={12} weight="fill" /> −{money(l.descuento)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-0.5 text-marca">
                          <PencilSimple size={12} /> editar
                        </span>
                      </p>
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between pl-12">
                    <Cantidad
                      key={l.cantidad}
                      valor={l.cantidad}
                      onChange={(c) => actualizar(i, { cantidad: c })}
                      onQuitar={() => quitar(i)}
                    />
                    <p className="num text-lg font-bold text-texto">{money(subtotalLinea(l))}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <footer className="pb-seguro fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-white px-4 pt-2 shadow-[0_-6px_20px_rgba(40,96,144,.08)]">
        <div className="mx-auto max-w-md">
          <details className="group text-sm text-gris">
            <summary className="flex cursor-pointer list-none items-center justify-between py-1.5">
              <span>
                {lineas.length} {lineas.length === 1 ? "producto" : "productos"} · {round(unidades, 3)} {unidades === 1 ? "unidad" : "unidades"}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-marca">
                Detalle <CaretDown size={14} weight="bold" className="transition group-open:rotate-180" />
              </span>
            </summary>
            <dl className="num space-y-1 pb-2">
              <Fila t={`Subtotal ${ctx.porcentajeIva}%`} v={totales.subtotalConIVA} />
              <Fila t="Subtotal 0%" v={totales.subtotalSinIVA} />
              <Fila t="Descuento" v={totales.totalDescuento} />
              <Fila t={`IVA ${ctx.porcentajeIva}%`} v={totales.iva} />
            </dl>
          </details>
          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gris">Total</p>
              <p className="num text-[1.7rem] font-bold leading-tight text-texto">{money(totales.totalAPagar)}</p>
            </div>
            <button
              className="btn-exito flex-1 py-3.5 text-lg"
              disabled={lineas.length === 0 || totales.totalAPagar <= 0 || !enLinea}
              onClick={() => setHoja("cobro")}
            >
              <Wallet size={22} weight="bold" /> Cobrar
            </button>
          </div>
        </div>
      </footer>

      {aviso && (
        <div
          key={aviso.id}
          role="status"
          className={`anim-aparecer fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+8.5rem)] z-40 mx-auto flex max-w-sm items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
            aviso.tipo === "ok" ? "bg-texto" : aviso.tipo === "aviso" ? "bg-aviso" : "bg-peligro"
          }`}
        >
          {aviso.tipo === "ok" ? <CheckCircle size={18} weight="fill" className="shrink-0 text-exito-claro" /> : <WarningCircle size={18} weight="fill" className="shrink-0" />}
          <span className="truncate">{aviso.texto}</span>
        </div>
      )}

      {hoja === "cliente" && (
        <HojaCliente
          ctx={ctx}
          onElegir={(c) => {
            setCliente(c);
            setHoja(null);
            avisar(`Cliente: ${c.IDCliente === cf.IDCliente ? "Consumidor final" : nombreCliente(c)}`);
          }}
          onCerrar={() => setHoja(null)}
        />
      )}
      {hoja && typeof hoja === "object" && lineas[hoja.editar] && (
        <HojaLinea
          linea={lineas[hoja.editar]}
          onGuardar={(c) => {
            actualizar(hoja.editar, c);
            setHoja(null);
          }}
          onQuitar={() => {
            quitar(hoja.editar);
            setHoja(null);
          }}
          onCerrar={() => setHoja(null)}
        />
      )}
      {hoja === "salir" && (
        <Hoja titulo="¿Descartar esta venta?" onCerrar={() => setHoja(null)}>
          <p className="text-sm text-gris">Se perderán los {lineas.length} productos agregados. Esta venta todavía no se ha guardado.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 pb-2">
            <button className="btn-secundario" onClick={() => setHoja(null)}>
              Seguir vendiendo
            </button>
            <button className="btn bg-peligro text-white" onClick={() => router.push("/ventas")}>
              <Trash size={18} /> Descartar
            </button>
          </div>
        </Hoja>
      )}
      {hoja === "cobro" && (
        <HojaCobro
          ctx={ctx}
          total={totales.totalAPagar}
          esConsumidorFinal={esCF}
          tipo={tipo}
          enLinea={enLinea}
          onCerrar={() => setHoja(null)}
          onGuardar={async (pago, observaciones) => {
            const r = await api<Resultado>("/api/ventas", {
              method: "POST",
              body: JSON.stringify({
                tipo,
                idCliente: cliente.IDCliente,
                observaciones,
                pago,
                lineas: lineas.map((l) => ({
                  idProducto: l.producto.IDProducto,
                  cantidad: l.cantidad,
                  precioVenta: l.precioVenta,
                  descuento: l.descuento,
                })),
              }),
            });
            vibrar(40);
            setResultado(r);
          }}
        />
      )}
    </main>
  );
}

function Fila({ t, v }: { t: string; v: number }) {
  return (
    <div className="flex justify-between">
      <dt>{t}</dt>
      <dd className="font-semibold text-texto">{money(round(v, 2))}</dd>
    </div>
  );
}

function Cantidad({ valor, onChange, onQuitar }: { valor: number; onChange: (n: number) => void; onQuitar: () => void }) {
  const [texto, setTexto] = useState(String(valor));
  const fijar = (n: number) => onChange(Math.max(0.001, round(n, 3)));
  const boton = "flex h-10 w-10 items-center justify-center text-texto active:bg-fondo";
  return (
    <div className="flex items-center overflow-hidden rounded-md border border-borde bg-white">
      {valor <= 1 ? (
        <button className={`${boton} text-peligro`} onClick={onQuitar} aria-label="Quitar producto">
          <Trash size={18} />
        </button>
      ) : (
        <button className={boton} onClick={() => fijar(valor - 1)} aria-label="Restar uno">
          <Minus size={18} weight="bold" />
        </button>
      )}
      <input
        inputMode="decimal"
        aria-label="Cantidad"
        value={texto}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => (num(texto) > 0 ? fijar(num(texto)) : setTexto(String(valor)))}
        className="num h-10 w-14 border-x border-borde text-center font-bold text-texto outline-none focus:bg-marca/5"
      />
      <button className={`${boton} text-marca`} onClick={() => fijar(valor + 1)} aria-label="Sumar uno">
        <Plus size={18} weight="bold" />
      </button>
    </div>
  );
}

function BuscadorProductos({ onAgregar }: { onAgregar: (p: Producto) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  async function buscar(texto: string) {
    const id = ++seq.current;
    setCargando(true);
    setError(null);
    try {
      const r = await api<Producto[]>(`/api/productos?q=${encodeURIComponent(texto)}`);
      if (id === seq.current) setRes(r);
      return r;
    } catch (e) {
      if (id === seq.current) setError((e as Error).message);
      return [];
    } finally {
      if (id === seq.current) setCargando(false);
    }
  }

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => buscar(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  function limpiar() {
    seq.current++;
    setQ("");
    setRes([]);
    setError(null);
    setCargando(false);
  }

  function elegir(p: Producto) {
    onAgregar(p);
    limpiar();
    input.current?.focus();
  }

  function cambiar(texto: string) {
    setQ(texto);
    if (texto.trim().length < 2) setRes([]);
  }

  // Enter (lectores de codigo de barras): si el codigo coincide exacto, agrega directo.
  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    const texto = q.trim();
    if (!texto) return;
    const r = await buscar(texto);
    const exacto = r.find((p) => p.Codigo.trim().toLowerCase() === texto.toLowerCase());
    if (exacto) elegir(exacto);
    else if (r.length === 1) elegir(r[0]);
  }

  const abierto = q.trim().length >= 2;

  return (
    <div className="relative">
      <form onSubmit={alEnviar} className="relative">
        <MagnifyingGlass size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gris" />
        <input
          ref={input}
          id="buscar-producto"
          type="search"
          enterKeyHint="search"
          value={q}
          onChange={(e) => cambiar(e.target.value)}
          placeholder="Buscar producto o código"
          className="campo py-3.5 pl-10 pr-11 [&::-webkit-search-cancel-button]:hidden"
          autoComplete="off"
        />
        <span className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gris">
          {cargando ? (
            <CircleNotch size={20} className="animate-spin text-marca" />
          ) : q ? (
            <button type="button" onClick={limpiar} aria-label="Limpiar búsqueda" className="flex h-full w-full items-center justify-center">
              <X size={18} weight="bold" />
            </button>
          ) : (
            <Barcode size={22} />
          )}
        </span>
      </form>
      {abierto && (res.length > 0 || error || !cargando) && (
        <ul className="anim-aparecer absolute inset-x-0 top-full z-10 mt-1 max-h-[55dvh] divide-y divide-borde overflow-y-auto rounded-lg border border-borde bg-white shadow-xl">
          {error && (
            <li className="flex items-center gap-2 p-3 text-sm text-peligro">
              <WarningCircle size={18} /> {error}
            </li>
          )}
          {!error && !cargando && res.length === 0 && (
            <li className="p-4 text-center text-sm text-gris">Sin resultados para “{q.trim()}”</li>
          )}
          {res.map((p) => (
            <li key={p.IDProducto}>
              <button onClick={() => elegir(p)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-marca/5">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold text-texto">{p.Descripcion}</p>
                  <p className="num mt-0.5 flex items-center gap-2 text-xs text-gris">
                    <span>{p.Codigo}</span>
                    <span
                      className={`rounded px-1.5 py-px font-semibold ${
                        p.Stock <= 0 ? "bg-peligro/10 text-peligro" : "bg-fondo text-texto"
                      }`}
                    >
                      Stock {round(p.Stock, 2)}
                    </span>
                  </p>
                </div>
                <span className="num font-bold text-marca-oscuro">{money(p.PrecioMinorista)}</span>
                <Plus size={18} weight="bold" className="text-marca" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Hoja({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = o;
      window.removeEventListener("keydown", esc);
    };
  }, [onCerrar]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45" onClick={onCerrar}>
      <div
        className="anim-subir pb-seguro flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-borde" />
        <div className="flex items-center justify-between px-4 pb-2 pt-2">
          <h2 className="text-lg font-bold text-texto">{titulo}</h2>
          <button onClick={onCerrar} className="flex h-9 w-9 items-center justify-center rounded-full text-gris hover:bg-fondo" aria-label="Cerrar">
            <X size={20} weight="bold" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pt-1">{children}</div>
      </div>
    </div>
  );
}

function Campo({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-[#696969]">
        {label}
      </label>
      {children}
    </div>
  );
}

function HojaLinea({
  linea,
  onGuardar,
  onQuitar,
  onCerrar,
}: {
  linea: Linea;
  onGuardar: (c: Partial<Linea>) => void;
  onQuitar: () => void;
  onCerrar: () => void;
}) {
  const [precio, setPrecio] = useState(String(linea.precioVenta));
  const [descuento, setDescuento] = useState(String(linea.descuento));
  const [cantidad, setCantidad] = useState(String(linea.cantidad));
  const p = linea.producto;
  const c = num(cantidad);
  const pv = num(precio);
  const d = num(descuento);
  const error =
    !(c > 0) ? "Ingrese una cantidad mayor a cero" : !(pv >= 0) ? "Ingrese un precio válido" : d < 0 || d > pv * c ? "El descuento no puede superar el valor de la línea" : null;

  return (
    <Hoja titulo="Editar producto" onCerrar={onCerrar}>
      <div className="mb-4 flex items-start gap-3 rounded-lg bg-fondo p-3">
        <Package size={28} weight="duotone" className="shrink-0 text-marca" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-texto">{p.Descripcion}</p>
          <p className="num text-xs text-gris">
            {p.Codigo} · Stock {round(p.Stock, 2)} · {p.AplicaIVA ? "Grava IVA" : "IVA 0%"}
          </p>
        </div>
      </div>
      <div className="space-y-3 pb-2">
        <Campo label="Cantidad" id="ed-cantidad">
          <input id="ed-cantidad" className="campo num" inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        </Campo>
        <Campo label="Precio de venta (incluye IVA)" id="ed-precio">
          <input id="ed-precio" className="campo num" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[
              ["Minorista", p.PrecioMinorista],
              ["Mayorista", p.PrecioMayorista],
            ].map(([t, v]) => (
              <button
                key={t as string}
                type="button"
                disabled={!(Number(v) > 0)}
                className={`btn border py-2 text-sm ${
                  num(precio) === Number(v) ? "border-marca bg-marca/10 text-marca-oscuro" : "border-borde bg-white text-texto"
                }`}
                onClick={() => setPrecio(String(v))}
              >
                {t} <span className="num font-bold">{money(Number(v))}</span>
              </button>
            ))}
          </div>
        </Campo>
        <Campo label="Descuento ($ sobre la línea)" id="ed-desc">
          <input id="ed-desc" className="campo num" inputMode="decimal" value={descuento} onChange={(e) => setDescuento(e.target.value)} />
        </Campo>
        {error && (
          <p className="flex items-center gap-2 text-sm text-peligro">
            <WarningCircle size={18} /> {error}
          </p>
        )}
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button className="btn border border-peligro/30 text-peligro" onClick={onQuitar} aria-label="Quitar producto">
            <Trash size={20} />
          </button>
          <button
            className="btn-primario"
            disabled={!!error}
            onClick={() => onGuardar({ cantidad: round(c, 3), precioVenta: round(pv, 4), descuento: round(d, 2) })}
          >
            <CheckCircle size={20} weight="bold" /> Aplicar · <span className="num">{money(pv * c - d)}</span>
          </button>
        </div>
      </div>
    </Hoja>
  );
}

function HojaCliente({
  ctx,
  onElegir,
  onCerrar,
}: {
  ctx: ContextoVenta;
  onElegir: (c: Cliente) => void;
  onCerrar: () => void;
}) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(false);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) return;
    let vigente = true;
    const t = setTimeout(async () => {
      setCargando(true);
      try {
        const r = await api<Cliente[]>(`/api/clientes?q=${encodeURIComponent(q.trim())}`);
        if (vigente) setRes(r);
      } catch {
        if (vigente) setRes([]);
      } finally {
        if (vigente) setCargando(false);
      }
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [q]);

  if (creando)
    return (
      <Hoja titulo="Nuevo cliente" onCerrar={onCerrar}>
        <FormCliente ctx={ctx} identificacion={/^\d+$/.test(q.trim()) ? q.trim() : ""} onCreado={onElegir} onVolver={() => setCreando(false)} />
      </Hoja>
    );

  return (
    <Hoja titulo="Elegir cliente" onCerrar={onCerrar}>
      <div className="relative">
        <MagnifyingGlass size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gris" />
        <input
          id="buscar-cliente"
          type="search"
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value.trim().length < 2) setRes([]);
          }}
          placeholder="Cédula, RUC o nombres"
          className="campo pl-10"
        />
        {cargando && <CircleNotch size={20} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-marca" />}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="btn-secundario py-2.5 text-sm" onClick={() => onElegir(ctx.consumidorFinal!)}>
          <Users size={18} /> Consumidor final
        </button>
        <button className="btn border border-marca/30 bg-marca/10 py-2.5 text-sm text-marca-oscuro" onClick={() => setCreando(true)}>
          <UserPlus size={18} weight="bold" /> Nuevo cliente
        </button>
      </div>
      <ul className="mt-2 divide-y divide-borde pb-4">
        {!cargando && q.trim().length >= 2 && res.length === 0 && (
          <li className="py-6 text-center text-sm text-gris">
            No encontramos “{q.trim()}”.
            <button className="mt-2 block w-full font-semibold text-marca" onClick={() => setCreando(true)}>
              Crear cliente nuevo
            </button>
          </li>
        )}
        {q.trim().length < 2 && (
          <li className="py-6 text-center text-sm text-gris">Escriba al menos 2 caracteres para buscar.</li>
        )}
        {res.map((c) => (
          <li key={c.IDCliente}>
            <button className="flex w-full items-center gap-3 py-3 text-left active:bg-fondo" onClick={() => onElegir(c)}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marca/10 text-sm font-bold text-marca-oscuro">
                {iniciales(c)}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-texto">{nombreCliente(c)}</span>
                <span className="num block truncate text-xs text-gris">
                  {c.NroIDentificacion}
                  {c.Correo?.trim() && ` · ${c.Correo.trim()}`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Hoja>
  );
}

function tipoPorLongitud(id: string) {
  if (/^\d{13}$/.test(id)) return "04";
  if (/^\d{10}$/.test(id)) return "05";
  return "06";
}

function FormCliente({
  ctx,
  identificacion,
  onCreado,
  onVolver,
}: {
  ctx: ContextoVenta;
  identificacion: string;
  onCreado: (c: Cliente) => void;
  onVolver: () => void;
}) {
  const tipos = ctx.tiposIdentificacion;
  const [f, setF] = useState({
    nroIdentificacion: identificacion,
    idTipoIdentificacion: "",
    nombres: "",
    apellidos: "",
    telefono: "",
    correo: "",
    direccion: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  const sugerido = tipoPorLongitud(f.nroIdentificacion.trim());
  const tipo =
    f.idTipoIdentificacion || (tipos.some((t) => t.IDTipoIdentificacion === sugerido) ? sugerido : tipos[0]?.IDTipoIdentificacion ?? "05");

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      onCreado(await api<Cliente>("/api/clientes", { method: "POST", body: JSON.stringify({ ...f, idTipoIdentificacion: tipo }) }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-3 pb-4">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Campo label="Identificación" id="cli-id">
          <div className="relative">
            <IdentificationCard size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gris" />
            <input
              id="cli-id"
              className="campo num pl-10"
              inputMode="numeric"
              maxLength={15}
              value={f.nroIdentificacion}
              onChange={set("nroIdentificacion")}
              required
              autoFocus
            />
          </div>
        </Campo>
        {tipos.length > 0 && (
          <Campo label="Tipo" id="cli-tipo">
            <select id="cli-tipo" className="campo pr-8" value={tipo} onChange={set("idTipoIdentificacion")}>
              {tipos.map((t) => (
                <option key={t.IDTipoIdentificacion} value={t.IDTipoIdentificacion}>
                  {t.Descripcion}
                </option>
              ))}
            </select>
          </Campo>
        )}
      </div>
      <Campo label="Nombres o razón social" id="cli-nom">
        <input id="cli-nom" className="campo uppercase" maxLength={50} value={f.nombres} onChange={set("nombres")} required />
      </Campo>
      <Campo label="Apellidos" id="cli-ape">
        <input id="cli-ape" className="campo uppercase" maxLength={50} value={f.apellidos} onChange={set("apellidos")} />
      </Campo>
      <Campo label="Correo (recibe la factura electrónica)" id="cli-correo">
        <input id="cli-correo" className="campo" type="email" inputMode="email" maxLength={50} value={f.correo} onChange={set("correo")} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Teléfono" id="cli-tel">
          <input id="cli-tel" className="campo" type="tel" maxLength={50} value={f.telefono} onChange={set("telefono")} />
        </Campo>
        <Campo label="Dirección" id="cli-dir">
          <input id="cli-dir" className="campo uppercase" maxLength={50} value={f.direccion} onChange={set("direccion")} />
        </Campo>
      </div>
      {error && (
        <p className="flex items-start gap-2 rounded-md bg-peligro/8 px-3 py-2 text-sm text-peligro">
          <WarningCircle size={18} className="mt-px shrink-0" /> {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-secundario" onClick={onVolver}>
          <CaretLeft size={18} /> Volver
        </button>
        <button className="btn-primario" disabled={guardando}>
          {guardando ? <CircleNotch size={20} className="animate-spin" /> : <UserCircle size={20} weight="bold" />}
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}

type Metodo = "efectivo" | "deposito" | "credito";

function HojaCobro({
  ctx,
  total,
  esConsumidorFinal,
  tipo,
  enLinea,
  onGuardar,
  onCerrar,
}: {
  ctx: ContextoVenta;
  total: number;
  esConsumidorFinal: boolean;
  tipo: TipoDocumento;
  enLinea: boolean;
  onGuardar: (pago: { efectivo: number; deposito: number; recibido: number }, observaciones: string) => Promise<void>;
  onCerrar: () => void;
}) {
  // frmPago: por defecto todo en efectivo (o a credito si COBROENEFECTIVO <> 1 y no es consumidor final).
  const todoCredito = !ctx.cobroEnEfectivo && !esConsumidorFinal;
  const [efectivo, setEfectivo] = useState(todoCredito ? "0" : total.toFixed(2));
  const [deposito, setDeposito] = useState("0");
  const [recibido, setRecibido] = useState("");
  const [obs, setObs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const e = round(num(efectivo), 2);
  const d = round(num(deposito), 2);
  const r = round(num(recibido), 2);
  const credito = round(total - e - d, 2);
  const vuelto = r > 0 ? round(r - e, 2) : 0;
  const metodo: Metodo | "mixto" = e === total ? "efectivo" : d === total ? "deposito" : e === 0 && d === 0 ? "credito" : "mixto";

  let validacion: string | null = null;
  if ([e, d, r].some((x) => Number.isNaN(x) || x < 0)) validacion = "Revise los valores ingresados";
  else if (credito < 0) validacion = "El pago supera el total a cobrar";
  else if (esConsumidorFinal && credito > 0) validacion = "Consumidor final no puede quedar a crédito";
  else if (r > 0 && r < e) validacion = "El valor recibido es menor al efectivo";
  else if (tipo === "factura" && esConsumidorFinal && ctx.limiteConsumidorFinal && total > ctx.limiteConsumidorFinal)
    validacion = `Una factura a consumidor final no puede superar ${money(ctx.limiteConsumidorFinal)}. Elija un cliente.`;

  const rapidos = [...new Set([Math.ceil(total), Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, Math.ceil(total / 20) * 20])]
    .filter((x) => x >= total)
    .slice(0, 4);

  function elegirMetodo(m: Metodo) {
    vibrar();
    setEfectivo(m === "efectivo" ? total.toFixed(2) : "0");
    setDeposito(m === "deposito" ? total.toFixed(2) : "0");
    if (m !== "efectivo") setRecibido("");
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await onGuardar({ efectivo: e, deposito: d, recibido: r }, obs);
    } catch (err) {
      setError((err as Error).message);
      setGuardando(false);
    }
  }

  const metodos: { id: Metodo; texto: string; icono: React.ReactNode; deshabilitado?: boolean }[] = [
    { id: "efectivo", texto: "Efectivo", icono: <Money size={26} weight="duotone" /> },
    { id: "deposito", texto: "Transferencia", icono: <Bank size={26} weight="duotone" /> },
    { id: "credito", texto: "Crédito", icono: <HandCoins size={26} weight="duotone" />, deshabilitado: esConsumidorFinal },
  ];

  return (
    <Hoja titulo="Cobrar" onCerrar={guardando ? () => {} : onCerrar}>
      <div className="mb-4 rounded-lg bg-gradient-to-br from-marca-oscuro to-marca p-4 text-center text-white">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Total a cobrar</p>
        <p className="num text-4xl font-bold">{money(total)}</p>
        <p className="mt-1 text-xs text-white/80">{tipo === "factura" ? "Factura" : "Nota de venta"}</p>
      </div>

      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gris">Forma de pago</p>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {metodos.map((m) => (
          <button
            key={m.id}
            disabled={m.deshabilitado}
            onClick={() => elegirMetodo(m.id)}
            className={`flex flex-col items-center gap-1 rounded-lg border-2 px-1 py-2.5 text-xs font-semibold transition disabled:opacity-40 ${
              metodo === m.id ? "border-marca bg-marca/10 text-marca-oscuro" : "border-borde bg-white text-texto"
            }`}
          >
            {m.icono}
            {m.texto}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Efectivo" id="pago-efectivo">
            <input id="pago-efectivo" className="campo num" inputMode="decimal" value={efectivo} onFocus={(x) => x.target.select()} onChange={(x) => setEfectivo(x.target.value)} />
          </Campo>
          <Campo label="Transferencia" id="pago-deposito">
            <input id="pago-deposito" className="campo num" inputMode="decimal" value={deposito} onFocus={(x) => x.target.select()} onChange={(x) => setDeposito(x.target.value)} />
          </Campo>
        </div>
        {e > 0 && (
          <Campo label="Recibido del cliente" id="pago-recibido">
            <input
              id="pago-recibido"
              className="campo num"
              inputMode="decimal"
              placeholder="Opcional, para calcular el vuelto"
              value={recibido}
              onChange={(x) => setRecibido(x.target.value)}
            />
            <div className="mt-2 grid grid-cols-4 gap-2">
              {rapidos.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`btn border px-1 py-2 text-sm ${r === v ? "border-marca bg-marca/10 text-marca-oscuro" : "border-borde bg-white text-texto"}`}
                  onClick={() => setRecibido(String(v))}
                >
                  ${v}
                </button>
              ))}
            </div>
          </Campo>
        )}
        <dl className="num grid grid-cols-2 gap-2 text-sm">
          <div className={`rounded-lg p-3 ${credito > 0 ? "bg-aviso/10" : "bg-fondo"}`}>
            <dt className="text-xs text-gris">A crédito</dt>
            <dd className={`text-lg font-bold ${credito > 0 ? "text-[#b45309]" : "text-texto"}`}>{money(Math.max(credito, 0))}</dd>
          </div>
          <div className={`rounded-lg p-3 ${vuelto > 0 ? "bg-exito/10" : "bg-fondo"}`}>
            <dt className="text-xs text-gris">Vuelto</dt>
            <dd className={`text-lg font-bold ${vuelto > 0 ? "text-exito" : "text-texto"}`}>{money(Math.max(vuelto, 0))}</dd>
          </div>
        </dl>
        <Campo label="Observaciones" id="pago-obs">
          <input id="pago-obs" className="campo" value={obs} maxLength={300} placeholder="Opcional" onChange={(x) => setObs(x.target.value)} />
        </Campo>
        {(validacion || error) && (
          <p className="flex items-start gap-2 rounded-md bg-peligro/8 px-3 py-2 text-sm text-peligro">
            <WarningCircle size={18} className="mt-px shrink-0" /> {validacion ?? error}
          </p>
        )}
        <button className="btn-exito mb-2 w-full py-4 text-lg" disabled={!!validacion || guardando || !enLinea} onClick={guardar}>
          {guardando ? <CircleNotch size={22} className="animate-spin" /> : <CheckCircle size={22} weight="bold" />}
          {guardando ? "Guardando..." : `Guardar ${tipo === "factura" ? "factura" : "nota de venta"}`}
        </button>
      </div>
    </Hoja>
  );
}

function PantallaExito({ r, onNueva }: { r: Resultado; onNueva: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col">
      <section className="barra-marca flex flex-col items-center px-6 pb-10 pt-[max(env(safe-area-inset-top),3rem)] text-center text-white">
        <div className="anim-aparecer flex h-20 w-20 items-center justify-center rounded-full bg-white text-exito shadow-lg">
          <CheckCircle size={56} weight="fill" />
        </div>
        <h1 className="mt-4 text-2xl font-bold">Venta registrada</h1>
        <p className="num mt-1 rounded-full bg-white/15 px-3 py-1 font-mono text-sm">{r.numero}</p>
      </section>
      <div className="-mt-6 flex-1 space-y-4 px-4">
        <div className="num rounded-xl bg-white p-4 shadow-lg shadow-marca-oscuro/10">
          <div className="flex items-center justify-between text-lg">
            <span className="text-gris">Total</span>
            <span className="font-bold text-texto">{money(r.total)}</span>
          </div>
          {r.vuelto > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-lg bg-exito/10 p-3">
              <span className="font-semibold text-exito">Vuelto</span>
              <span className="text-3xl font-bold text-exito">{money(r.vuelto)}</span>
            </div>
          )}
          {r.claveAcceso && (
            <p className="mt-3 break-all border-t border-borde pt-3 text-[11px] leading-relaxed text-gris">
              <span className="font-semibold">Clave de acceso:</span> {r.claveAcceso}
            </p>
          )}
        </div>
      </div>
      <div className="pb-seguro grid gap-2 px-4 pt-4">
        <button className="btn-primario w-full py-4 text-lg" onClick={onNueva}>
          <Plus size={22} weight="bold" /> Nueva venta
        </button>
        <Link href="/ventas" className="btn-secundario w-full">
          <ListBullets size={20} /> Ver ventas de hoy
        </Link>
      </div>
    </main>
  );
}
