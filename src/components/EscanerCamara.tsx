"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, CircleNotch, Flashlight, WarningCircle, X } from "@phosphor-icons/react";
import type { IScannerControls } from "@zxing/browser";

export type ResultadoEscaneo = { ok: boolean; texto: string };

// Como un escaner de mano: el mismo codigo se vuelve a contar pasado este tiempo, aunque siga a la vista.
// Para agregar n unidades se deja el producto frente a la camara (o se vuelve a pasar) n veces.
// Subirlo si se agregan unidades de mas; bajarlo para escanear mas rapido.
const PAUSA_MISMO_CODIGO_MS = 1000;

/** Genera un WAV (PCM 16 bits mono) con una secuencia de tonos [frecuencia Hz, segundos]; 0 Hz = silencio. */
function wav(tonos: [number, number][]) {
  const hz = 22050;
  const muestras: number[] = [];
  for (const [f, s] of tonos) {
    const n = Math.round(hz * s);
    for (let i = 0; i < n; i++) {
      const envolvente = Math.min(1, i / 200, (n - i) / 200); // evita el "clic" al inicio y al final
      muestras.push(f ? Math.sin((2 * Math.PI * f * i) / hz) * 0.8 * envolvente : 0);
    }
  }
  const buf = new DataView(new ArrayBuffer(44 + muestras.length * 2));
  const txt = (o: number, s: string) => [...s].forEach((c, i) => buf.setUint8(o + i, c.charCodeAt(0)));
  txt(0, "RIFF");
  buf.setUint32(4, 36 + muestras.length * 2, true);
  txt(8, "WAVEfmt ");
  buf.setUint32(16, 16, true);
  buf.setUint16(20, 1, true);
  buf.setUint16(22, 1, true);
  buf.setUint32(24, hz, true);
  buf.setUint32(28, hz * 2, true);
  buf.setUint16(32, 2, true);
  buf.setUint16(34, 16, true);
  txt(36, "data");
  buf.setUint32(40, muestras.length * 2, true);
  muestras.forEach((m, i) => buf.setInt16(44 + i * 2, m * 32767, true));
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

// Se usa <audio> y no Web Audio: en iPhone Web Audio queda mudo con el switch de silencio y al
// encender la camara. Cada elemento se "desbloquea" reproduciendolo en silencio dentro del toque
// que abre el escaner; despues el navegador permite reproducirlo sin gesto del usuario.
let sonidos: { ok: HTMLAudioElement; error: HTMLAudioElement } | null = null;
export function desbloquearAudio() {
  try {
    sonidos ??= {
      ok: new Audio(wav([[1500, 0.09], [0, 0.04], [2000, 0.13]])), // "bip-bip" agudo: registrado
      error: new Audio(wav([[300, 0.4]])), // tono grave largo: no registrado
    };
    for (const a of Object.values(sonidos)) {
      a.muted = true;
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
        })
        .catch(() => {});
    }
  } catch {}
}

function pitido(ok: boolean) {
  const a = ok ? sonidos?.ok : sonidos?.error;
  if (!a) return;
  a.muted = false;
  a.currentTime = 0;
  a.play().catch(() => {});
}

// @zxing/library 0.23 registra con console.warn cada cuadro sin codigo ("NotFoundException"):
// sus excepciones no pasan el instanceof por un bug de herencia. No son errores; se filtran solo esas.
const EXCEPCIONES_NORMALES = new Set(["NotFoundException", "ChecksumException", "FormatException"]);
function silenciarAvisosZxing() {
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    const ex = args[1] as { constructor?: { kind?: string }; name?: string } | undefined;
    const normal = EXCEPCIONES_NORMALES.has(ex?.name ?? "") || EXCEPCIONES_NORMALES.has(ex?.constructor?.kind ?? "");
    if (normal && String(args[0]).startsWith("MultiFormatReader: non-ReaderException")) return;
    original(...args);
  };
  return () => {
    console.warn = original;
  };
}

/** Descarga la libreria de lectura (una sola vez). Se llama al abrir la venta para que el escaner abra al instante. */
let libreria: Promise<[typeof import("@zxing/browser"), typeof import("@zxing/library")]> | null = null;
export function precargarEscaner() {
  libreria ??= Promise.all([import("@zxing/browser"), import("@zxing/library")]);
  libreria.catch(() => (libreria = null)); // si falla la red, se reintenta la proxima vez
  return libreria;
}

function mensajeError(e: unknown) {
  const nombre = (e as Error)?.name;
  if (typeof window !== "undefined" && !window.isSecureContext)
    return "La cámara solo funciona si la app se abre con HTTPS. Pida al administrador publicarla con certificado.";
  if (nombre === "NotAllowedError") return "No se dio permiso para usar la cámara. Actívelo en los permisos del navegador para este sitio.";
  if (nombre === "NotFoundError" || nombre === "OverconstrainedError") return "No se encontró una cámara en este dispositivo.";
  if (nombre === "NotReadableError") return "Otra aplicación está usando la cámara. Ciérrela e intente de nuevo.";
  return "No se pudo abrir la cámara.";
}

/**
 * Escaner de codigos de barras con la camara (lectura continua).
 * Cada codigo leido se envia a onCodigo, que agrega el producto y devuelve el texto a mostrar.
 */
export default function EscanerCamara({
  onCodigo,
  onCerrar,
}: {
  onCodigo: (codigo: string) => Promise<ResultadoEscaneo>;
  onCerrar: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const controles = useRef<IScannerControls | null>(null);
  const ultimo = useRef<{ codigo: string; t: number; veces: number }>({ codigo: "", t: 0, veces: 0 });
  const ocupado = useRef(false);
  const onCodigoRef = useRef(onCodigo);
  const [estado, setEstado] = useState<"iniciando" | "listo" | "error">("iniciando");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState<(ResultadoEscaneo & { id: number; veces: number }) | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [agregados, setAgregados] = useState(0);
  const [linterna, setLinterna] = useState<boolean | null>(null);

  useEffect(() => {
    onCodigoRef.current = onCodigo;
  }, [onCodigo]);

  useEffect(() => {
    let cancelado = false;
    let camara: Promise<MediaStream> | null = null;
    desbloquearAudio();
    const restaurarWarn = silenciarAvisosZxing();

    (async () => {
      try {
        // La camara se pide a la vez que se carga la libreria (antes era una despues de la otra).
        camara = navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        const [{ BrowserMultiFormatReader, HTMLCanvasElementLuminanceSource }, { BarcodeFormat, DecodeHintType }] = await precargarEscaner();
        // Bug de @zxing/browser (tempCanvasElement queda undefined y compara con null):
        // sin esto TRY_HARDER falla al rotar y llena la consola de "Could not create a Canvas element".
        (HTMLCanvasElementLuminanceSource.prototype as unknown as { tempCanvasElement: null }).tempCanvasElement ??= null;
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.ITF,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const lector = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
        const stream = await camara;
        // Si el efecto ya se desmonto (StrictMode monta dos veces) no se toca el <video>:
        // al detenerse limpiaria el srcObject del montaje vivo y la camara quedaria en negro.
        if (cancelado || !video.current) return stream.getTracks().forEach((t) => t.stop());
        const c = await lector.decodeFromStream(
          stream,
          video.current,
          async (resultado) => {
            if (!resultado) return;
            const codigo = resultado.getText().trim();
            const ahora = Date.now();
            if (ocupado.current) return;
            const repetido = codigo === ultimo.current.codigo;
            if (repetido && ahora - ultimo.current.t < PAUSA_MISMO_CODIGO_MS) return;
            const veces = repetido ? ultimo.current.veces + 1 : 1;
            ultimo.current = { codigo, t: ahora, veces };
            ocupado.current = true;
            setProcesando(true);
            let r: ResultadoEscaneo;
            try {
              r = await onCodigoRef.current(codigo);
            } catch (e) {
              r = { ok: false, texto: (e as Error).message };
            }
            pitido(r.ok);
            try {
              navigator.vibrate?.(r.ok ? 40 : [60, 60, 60]);
            } catch {}
            if (r.ok) setAgregados((n) => n + 1);
            setAviso({ ...r, id: ahora, veces: r.ok ? veces : 1 });
            setProcesando(false);
            // La pausa cuenta desde que termina de agregarse; si fallo, la racha de "veces" se reinicia.
            ultimo.current = { codigo, t: Date.now(), veces: r.ok ? veces : 0 };
            ocupado.current = false;
          }
        );
        if (cancelado) return c.stop();
        controles.current = c;
        const capacidades = c.streamVideoCapabilitiesGet?.((t) => [t]) as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
        if (capacidades?.torch && c.switchTorch) setLinterna(false);
        setEstado("listo");
      } catch (e) {
        // Si fallo la libreria con la camara ya abierta, se libera para no dejarla encendida.
        camara?.then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => {});
        if (cancelado) return;
        setError(mensajeError(e));
        setEstado("error");
      }
    })();

    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelado = true;
      controles.current?.stop();
      controles.current = null;
      restaurarWarn();
      document.body.style.overflow = o;
    };
  }, []);

  async function alternarLinterna() {
    if (linterna === null || !controles.current?.switchTorch) return;
    try {
      await controles.current.switchTorch(!linterna);
      setLinterna(!linterna);
    } catch {
      setLinterna(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Escanear productos">
      {/* Oculto hasta que la camara entrega imagen: si no, se ve pequeño un instante y luego se expande */}
      <video
        ref={video}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${estado === "listo" ? "opacity-100" : "opacity-0"}`}
        muted
        playsInline
        autoPlay
      />

      {/* Marco guia con linea de lectura */}
      {estado === "listo" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-40 w-[80%] max-w-sm rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,.45)]">
            <span className="absolute -left-0.5 -top-0.5 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-white" />
            <span className="absolute -right-0.5 -top-0.5 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-white" />
            <span className="absolute -bottom-0.5 -left-0.5 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-white" />
            <span className="absolute -bottom-0.5 -right-0.5 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-white" />
            <span className="linea-escaner absolute inset-x-3 h-0.5 rounded-full bg-peligro shadow-[0_0_10px_2px_rgba(221,29,86,.7)]" />
          </div>
        </div>
      )}

      <header className="pt-seguro relative flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-6">
        <button onClick={onCerrar} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15" aria-label="Cerrar escáner">
          <X size={22} weight="bold" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">Escanear productos</h2>
          <p className="text-xs text-white/75">Apunte al código de barras o a la etiqueta de la balanza</p>
        </div>
        {linterna !== null && (
          <button
            onClick={alternarLinterna}
            className={`flex h-10 w-10 items-center justify-center rounded-full ${linterna ? "bg-white text-black" : "bg-white/15"}`}
            aria-label={linterna ? "Apagar linterna" : "Encender linterna"}
            aria-pressed={linterna}
          >
            <Flashlight size={22} weight={linterna ? "fill" : "regular"} />
          </button>
        )}
      </header>

      <div className="relative flex flex-1 items-center justify-center px-6">
        {estado === "iniciando" && (
          <p className="flex items-center gap-2 text-sm text-white/85">
            <CircleNotch size={20} className="animate-spin" /> Abriendo la cámara...
          </p>
        )}
        {estado === "error" && (
          <div className="max-w-xs rounded-xl bg-white p-5 text-center text-texto">
            <WarningCircle size={40} weight="duotone" className="mx-auto mb-2 text-peligro" />
            <p className="text-sm">{error}</p>
            <button onClick={onCerrar} className="btn-primario mt-4 w-full">
              Escribir el código
            </button>
          </div>
        )}
      </div>

      <footer className="pb-seguro relative space-y-3 bg-gradient-to-t from-black/80 to-transparent px-4 pt-8">
        <div className="mx-auto min-h-12 max-w-sm">
          {procesando ? (
            <p className="flex items-center justify-center gap-2 rounded-lg bg-white/15 px-4 py-3 text-sm">
              <CircleNotch size={18} className="animate-spin" /> Buscando producto...
            </p>
          ) : (
            aviso && (
              <p
                key={aviso.id}
                className={`anim-aparecer flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold ${
                  aviso.ok ? "bg-exito text-white" : "bg-peligro text-white"
                }`}
              >
                {aviso.ok ? <CheckCircle size={20} weight="fill" className="shrink-0" /> : <WarningCircle size={20} weight="fill" className="shrink-0" />}
                <span className="line-clamp-2 flex-1">{aviso.texto}</span>
                {aviso.veces > 1 && <span className="shrink-0 rounded-full bg-white/25 px-2 py-0.5 text-base tabular-nums">×{aviso.veces}</span>}
              </p>
            )
          )}
        </div>
        <button onClick={onCerrar} className="btn mx-auto flex w-full max-w-sm bg-white py-3.5 text-base text-texto">
          {agregados > 0 ? `Listo · ${agregados} ${agregados === 1 ? "producto agregado" : "productos agregados"}` : "Cerrar"}
        </button>
      </footer>
    </div>
  );
}
