# Instalación en la PC de la tienda

InventX Móvil se instala en la **misma PC donde están InventX escritorio y SQL Server**. Los celulares entran por la VPN de **Tailscale** y **Caddy** publica la app con HTTPS válido. El HTTPS es obligatorio para usar la cámara y para instalar la app.

```
Celular (app Tailscale) ──VPN──► PC de la tienda
                                  ├─ Caddy  :443  https://inventx.<tailnet>.ts.net  (certificado de Tailscale)
                                  ├─ App Next.js  127.0.0.1:3000  (solo accesible por Caddy)
                                  ├─ SQL Server   localhost        (no se expone)
                                  └─ InventX escritorio  (imprime los tickets de la cola)
```

## 1. Tailscale (una sola vez)

1. Crear la red en <https://login.tailscale.com>.
2. En **DNS** (<https://login.tailscale.com/admin/dns>), activar **MagicDNS** y **HTTPS Certificates**.
3. Instalar Tailscale en la PC de la tienda e iniciar sesión.
   - En **Machines**, renombrar el equipo a algo corto, por ejemplo `inventx`. La dirección queda como `inventx.<tailnet>.ts.net`.
   - En el menú del equipo, elegir **Disable key expiry** para que la PC no se desconecte cada 6 meses.
4. Instalar la app Tailscale en cada celular e iniciar sesión **con la misma red**. Para los empleados se puede compartir el equipo o invitarlos a la red.

## 2. SQL Server

- En **SQL Server Configuration Manager → Protocolos de SQL Server**, habilitar **TCP/IP** y reiniciar el servicio.
- Si es una instancia con nombre (`EQUIPO\SQLEXPRESS`), dejar en ejecución el servicio **SQL Server Browser**.
- Usar un usuario SQL (por ejemplo `sa` u otro con acceso a la base `ventas`).

### Scripts de la base de datos

Ejecute estos scripts una vez en la base de InventX, desde SSMS o con `sqlcmd -i`. Están en `InventX/Database/Scripts` y se pueden ejecutar más de una vez sin problema.

| Script | Para qué |
|---|---|
| `CreateTable_ColaImpresion.sql` | Imprimir en la caja los tickets pedidos desde la app web |
| `Parametros_Balanza.sql` | Lectura de etiquetas de balanza |
| `CreateTable_BalanzaDescartado.sql` | Asistente de productos por peso |
| `CreateTable_Permisos_PuntosUsuario.sql` | Roles, permisos, puntos por usuario y puntos web |

Después, en InventX escritorio, en **Ajustes**:
- **Permisos**: revise qué puede hacer cada rol.
- **Usuarios**: cree a los vendedores, asígneles un rol y sus puntos de venta.
- **Puntos web**: cree los puntos sin PC fija (su propia serie y la caja que imprime sus tickets). Esta pantalla también muestra el **QR para abrir la app**.

## 3. Instalar la app

1. Instalar **Node.js LTS** (<https://nodejs.org>) y **Git**.
2. Descargar el proyecto:
   ```powershell
   git clone https://github.com/yanditv/inventx-movil.git C:\InventX\inventx-movil
   cd C:\InventX\inventx-movil
   copy .env.example .env.local
   notepad .env.local    # completar DB_*, SESSION_SECRET
   ```
3. Abrir **PowerShell como administrador** y ejecutar:
   ```powershell
   powershell -ExecutionPolicy Bypass -File C:\InventX\inventx-movil\deploy\instalar.ps1
   ```
   El script:
   - prueba la conexión a SQL Server;
   - compila la app;
   - descarga Caddy;
   - registra la app para que arranque con Windows y se reinicie sola;
   - registra Caddy como servicio;
   - comprueba que `https://inventx.<tailnet>.ts.net` responde.

Al terminar muestra la dirección. En el celular, con Tailscale conectado, se abre esa dirección y se toca **Instalar app**.

## Actualizar

```powershell
cd C:\InventX\inventx-movil
git pull
powershell -ExecutionPolicy Bypass -File deploy\instalar.ps1
```

## Si algo falla

| Síntoma | Revisar |
|---|---|
| El script dice que no puede conectarse a la base | TCP/IP habilitado, usuario y contraseña SQL, `DB_SERVER`/`DB_PORT` en `.env.local` |
| La dirección `.ts.net` no abre en el celular | Que Tailscale esté conectado en el celular y en la PC |
| Error de certificado | Que **HTTPS Certificates** esté activado en la consola DNS de Tailscale |
| La página no carga | Registros en `C:\InventX\movil\logs\` (`app.log` y `caddy.log`) |
| No se imprimen los tickets | Que InventX escritorio esté abierto en la PC de esa caja |

Servicios instalados:
- tarea programada **InventX Movil** (la app);
- servicio **caddy-inventx** (HTTPS).

Ambos se ven en el Programador de tareas y en Servicios de Windows.
