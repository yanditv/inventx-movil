"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, CircleNotch, Flashlight, WarningCircle, X } from "@phosphor-icons/react";
import type { IScannerControls } from "@zxing/browser";

export type ResultadoEscaneo = { ok: boolean; texto: string };

// Un mismo codigo solo se vuelve a contar si estuvo fuera de la camara al menos este tiempo:
// mientras el producto siga a la vista no se agrega dos veces.
const PAUSA_MISMO_CODIGO_MS = 2500;

function pitido(ctx: AudioContext | null, ok: boolean) {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.frequency.value = ok ? 1800 : 300;
    vol.gain.setValueAtTime(0.15, ctx.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (ok ? 0.12 : 0.3));
    osc.connect(vol).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.3));
  } catch {}
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
  const audio = useRef<AudioContext | null>(null);
  const ultimo = useRef<{ codigo: string; t: number }>({ codigo: "", t: 0 });
  const ocupado = useRef(false);
  const onCodigoRef = useRef(onCodigo);
  const [estado, setEstado] = useState<"iniciando" | "listo" | "error">("iniciando");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState<(ResultadoEscaneo & { id: number }) | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [agregados, setAgregados] = useState(0);
  const [linterna, setLinterna] = useState<boolean | null>(null);

  useEffect(() => {
    onCodigoRef.current = onCodigo;
  }, [onCodigo]);

  useEffect(() => {
    let cancelado = false;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    audio.current = Ctx ? new Ctx() : null;
    audio.current?.resume().catch(() => {});

    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
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
        const c = await lector.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          video.current!,
          async (resultado) => {
            if (!resultado) return;
            const codigo = resultado.getText().trim();
            const ahora = Date.now();
            if (codigo === ultimo.current.codigo && ahora - ultimo.current.t < PAUSA_MISMO_CODIGO_MS) {
              ultimo.current.t = ahora; // sigue a la vista: se extiende la pausa
              return;
            }
            if (ocupado.current) return;
            ultimo.current = { codigo, t: ahora };
            ocupado.current = true;
            setProcesando(true);
            let r: ResultadoEscaneo;
            try {
              r = await onCodigoRef.current(codigo);
            } catch (e) {
              r = { ok: false, texto: (e as Error).message };
            }
            pitido(audio.current, r.ok);
            try {
              navigator.vibrate?.(r.ok ? 40 : [60, 60, 60]);
            } catch {}
            if (r.ok) setAgregados((n) => n + 1);
            setAviso({ ...r, id: ahora });
            setProcesando(false);
            ultimo.current = { codigo, t: Date.now() };
            ocupado.current = false;
          }
        );
        if (cancelado) return c.stop();
        controles.current = c;
        const capacidades = c.streamVideoCapabilitiesGet?.((t) => [t]) as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
        if (capacidades?.torch && c.switchTorch) setLinterna(false);
        setEstado("listo");
      } catch (e) {
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
      audio.current?.close().catch(() => {});
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
      <video ref={video} className="absolute inset-0 h-full w-full object-cover" muted playsInline autoPlay />

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
                <span className="line-clamp-2">{aviso.texto}</span>
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
