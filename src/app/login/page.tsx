import { EnvelopeSimple, Headset, Phone } from "@phosphor-icons/react/ssr";
import Logo from "@/components/Logo";
import { InstalarApp } from "@/components/pwa";
import FormLogin from "./FormLogin";

export default function LoginPage() {
  return (
    <main className="fondo-marca relative flex min-h-dvh flex-col overflow-hidden">
      {/* Formas suaves sobre el degradado del panel del login de escritorio */}
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-white/10" />

      <div className="pt-seguro relative flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm space-y-6">
          <header className="flex flex-col items-center text-center text-white">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/10">
              <Logo className="h-10 w-10" />
            </div>
            <h1 className="text-[2rem] font-bold leading-none tracking-tight">InventX</h1>
            <p className="mt-1.5 text-sm text-white/85">Sistema ventas y control de inventarios</p>
          </header>

          <section className="rounded-xl bg-white p-6 shadow-2xl shadow-black/20">
            <h2 className="text-lg font-bold text-[#696969]">Login</h2>
            <p className="mb-5 text-sm text-gris">Ingrese con su usuario de InventX</p>
            <FormLogin />
            <p className="mt-5 text-center text-xs leading-relaxed text-gris">
              Si no recuerda su usuario o contraseña, comuníquese con el proveedor del sistema
            </p>
          </section>

          <InstalarApp />
        </div>
      </div>

      <footer className="pb-seguro relative px-6 pt-2 text-xs text-white/85">
        <div className="mx-auto flex max-w-sm flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Headset size={16} weight="fill" /> Soporte técnico
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Phone size={14} /> 0991520991
          </span>
          <span className="inline-flex items-center gap-1.5">
            <EnvelopeSimple size={14} /> info@progice.com
          </span>
        </div>
      </footer>
    </main>
  );
}
