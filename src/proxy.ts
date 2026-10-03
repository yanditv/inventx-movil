import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "inventx_session";

// Verificacion optimista: sin sesion valida se redirige al login.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value;
  let valido = false;
  if (token && process.env.SESSION_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET), { algorithms: ["HS256"] });
      valido = true;
    } catch {}
  }
  const esLogin = request.nextUrl.pathname.startsWith("/login");
  if (!valido && !esLogin) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sesion expirada" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (valido && esLogin) return NextResponse.redirect(new URL("/ventas", request.url));
  return NextResponse.next();
}

export const config = {
  // Archivos de la PWA y la pantalla sin conexion quedan fuera del control de sesion.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|manifest.webmanifest|sw.js|icons/|offline).*)"],
};
