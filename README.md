# InventX Móvil

Versión web para celular de InventX (Next.js). Se conecta **directamente a la misma base de datos SQL Server** que usa la aplicación de escritorio, así que las ventas aparecen en InventX igual que las que se registran en caja.

## Pantallas

- **/login**: usuario y contraseña de la tabla `Empleado`, igual que `frmLogin`. Solo pueden entrar empleados con `Estado = 1`.
- **/punto**: elección del punto de acceso (serie `establecimiento-ptoEmision`). Si la sucursal tiene uno solo, se elige automáticamente.
- **/ventas**: resumen y lista de las ventas del día del usuario.
- **/ventas/nueva**: registro de una venta. Tiene factura o nota de venta, cliente (buscar o crear), productos (buscar por nombre o código, compatible con lector de código de barras), cantidades, precio minorista o mayorista, descuentos y cobro (efectivo, depósito o crédito, con recibido y vuelto).

## Cómo se guarda una venta

Se replica `VentaDAO.Add` del escritorio dentro de una sola transacción:

1. El secuencial se calcula como `MAX + 1` por sucursal, punto, serie, prefijo y ambiente. Se usa `UPDLOCK, HOLDLOCK` para que dos dispositivos no obtengan el mismo número.
2. `INSERT Pago`.
3. `INSERT Venta`. El trigger `createDocumentoElectronicoVenta` genera la clave de acceso y el `DocumentoElectronico` de las facturas. El envío al SRI lo sigue haciendo el servicio de InventX escritorio.
4. `INSERT VentaDetalleProducto`.

Los totales se calculan igual que en `Venta.Partial.cs`: el precio incluye IVA y el porcentaje viene del parámetro `IVA`. El servidor recalcula todo y toma `AplicaIVA` de la base, no del navegador.

Se respetan estos parámetros: `ClienteDefault`, `PrefijoCodificacionFacturas`, `PrefijoCodificacionNotaVentas`, `CONTROLCAJA` (exige caja abierta), `LimitAmoutDefault`, `COBROENEFECTIVO` y `COMPRASCOMOGASTOS`.

Igual que en el escritorio, la venta **no descuenta stock** ni registra movimiento de caja.

## Instalación en la tienda

En PowerShell como administrador: `irm https://github.com/yanditv/inventx-movil/releases/latest/download/instalar-web.ps1 | iex` (instala o actualiza desde la última [Release](https://github.com/yanditv/inventx-movil/releases), sin Git ni Node.js). Detalles en **[deploy/INSTALACION.md](deploy/INSTALACION.md)**: se instala en la PC de InventX con Caddy (HTTPS) y Tailscale (VPN para los celulares).

## Configuración (desarrollo)

```bash
cp .env.example .env.local   # completar servidor, usuario y contraseña de SQL Server
npm install
npm run dev                  # desarrollo; muestra en la terminal un QR con la dirección de red
npm run build && npm start   # producción
```

## PWA (app instalable)

- **Manifest**: `src/app/manifest.ts`. Los íconos de `public/icons` salen del logo de InventX escritorio (`npm run iconos`).
- **Service worker**: `public/sw.js`. Guarda en caché los archivos estáticos y muestra `/offline` cuando no hay red. Las ventas y búsquedas siempre van al servidor; nunca se guardan datos de ventas en el celular. Solo se registra en producción (`npm run build && npm start`).
- **Instalación**: el botón "Instalar app" aparece en el login y en la lista de ventas (Android/Chrome). En iPhone muestra los pasos de Safari.
- **Requisito**: el navegador solo permite instalar la app desde **HTTPS** (o `localhost`). Para probar en la red local: `npm run dev:https`. En producción hay que publicarla detrás de un certificado, por ejemplo con un proxy inverso (Caddy, IIS) o un túnel (Cloudflare Tunnel).

Para usarlo desde el celular, el servidor Next.js debe poder llegar a SQL Server, y el celular debe poder llegar al servidor Next.js (misma red o publicado con HTTPS). Desde la misma red: `npm start -- -H 0.0.0.0` y abrir `http://IP-del-servidor:3000`. En el celular se puede "Agregar a pantalla de inicio" para usarlo como app.
