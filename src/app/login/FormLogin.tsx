"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CircleNotch, Eye, EyeSlash, LockKey, SignIn, User, WarningCircle } from "@phosphor-icons/react";
import { iniciarSesion, type EstadoLogin } from "../acciones";

const CLAVE_USUARIO = "inventx:ultimo-usuario";

export default function FormLogin() {
  const [estado, accion, cargando] = useActionState<EstadoLogin, FormData>(iniciarSesion, {});
  const [ver, setVer] = useState(false);
  const [mayus, setMayus] = useState(false);
  const usuarioRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  // Como en el escritorio: recuerda el ultimo usuario y pone el foco en la contraseña.
  useEffect(() => {
    if (estado.usuario) return;
    try {
      const ultimo = localStorage.getItem(CLAVE_USUARIO);
      if (ultimo && usuarioRef.current && !usuarioRef.current.value) {
        usuarioRef.current.value = ultimo;
        passRef.current?.focus();
        return;
      }
    } catch {}
    usuarioRef.current?.focus();
  }, [estado.usuario]);

  useEffect(() => {
    if (estado.error) passRef.current?.select();
  }, [estado]);

  return (
    <form
      action={accion}
      className="space-y-4"
      onSubmit={() => {
        try {
          localStorage.setItem(CLAVE_USUARIO, usuarioRef.current?.value.trim() ?? "");
        } catch {}
      }}
    >
      <div>
        <label htmlFor="usuario" className="mb-1.5 block text-sm font-semibold text-[#696969]">
          Usuario
        </label>
        <div className="relative">
          <User size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gris" />
          <input
            ref={usuarioRef}
            id="usuario"
            name="usuario"
            className="campo pl-10"
            placeholder="Ingrese su usuario"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            defaultValue={estado.usuario}
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-[#696969]">
          Contraseña
        </label>
        <div className="relative">
          <LockKey size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gris" />
          <input
            ref={passRef}
            id="password"
            name="password"
            type={ver ? "text" : "password"}
            className="campo pl-10 pr-12"
            placeholder="Contraseña"
            autoComplete="current-password"
            enterKeyHint="go"
            onKeyUp={(e) => setMayus(e.getModifierState?.("CapsLock") ?? false)}
            required
          />
          <button
            type="button"
            onClick={() => setVer((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gris hover:text-marca"
            aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {ver ? <EyeSlash size={20} /> : <Eye size={20} />}
          </button>
        </div>
        {mayus && <p className="mt-1 text-xs text-aviso">Bloq Mayús está activado</p>}
      </div>

      {estado.error && (
        <p role="alert" className="anim-aparecer flex items-start gap-2 rounded-[6px] bg-peligro/8 px-3 py-2.5 text-sm text-peligro">
          <WarningCircle size={20} weight="fill" className="mt-px shrink-0" />
          {estado.error}
        </p>
      )}

      <button type="submit" disabled={cargando} className="btn-primario w-full text-base">
        {cargando ? <CircleNotch size={20} className="animate-spin" /> : <SignIn size={20} weight="bold" />}
        {cargando ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
