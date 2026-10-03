// Version de la compilacion en ejecucion. Publica (sin sesion): la usa la app para detectar
// si el servidor esta disponible y si hay una version nueva.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ version: process.env.VERSION_APP }, { headers: { "Cache-Control": "no-store" } });
}
