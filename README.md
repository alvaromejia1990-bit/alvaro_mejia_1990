# CAPSULA · Tienda de gorras (estilo retro arcade)

Sitio web estático listo para **GitHub Pages**: catálogo con inventario, carrito, pago por **Bre-B**, confirmación del pedido por **WhatsApp (+57 310 302 4205)** y panel administrativo de inventario.

## Secciones

| Sección | Qué hace |
|---|---|
| **Nosotros** | Presentación de la marca y cifras (modelos activos, gorras vendidas). |
| **Catálogo** | Imagen, referencia, precio, cantidad en stock y unidades vendidas. Filtros por categoría, búsqueda y orden. Alertas de «últimas unidades» y «agotado». |
| **Ventas** | 1) Carrito → 2) Datos del cliente (nombre, correo, dirección, teléfono, información adicional) → 3) Pago Bre-B (llave, valor exacto, número de comprobante y confirmación) → 4) Botón que abre WhatsApp con el resumen completo: productos, cantidades, precios, totales, confirmación de pago y datos del cliente. |
| **Contáctanos** | Mensajería (formulario que envía por WhatsApp o correo), WhatsApp, correo y redes sociales. |
| **admin.html** | Panel administrativo: inventario editable, entradas de mercancía, alertas de stock bajo, pedidos con estados, historial de movimientos, exportación JSON/CSV. |

## Estructura

```
index.html                 Tienda
admin.html                 Panel administrativo (enlace en el pie de página)
css/styles.css             Estilos
js/config.js               ← DATOS DE SU NEGOCIO (edite aquí)
js/inventario.js           Lógica de inventario (verificación y descuento automático)
js/app.js                  Catálogo, carrito, checkout y WhatsApp
js/admin.js                Panel administrativo
data/inventario.js         Base de inventarios publicada (editable)
img/                       Imágenes de las gorras (reemplácelas por fotos reales)
google-apps-script/Code.gs Opcional: inventario compartido en Google Sheets
.nojekyll                  Indica a GitHub Pages que sirva los archivos tal cual
```

## Publicar en GitHub Pages

1. Cree un repositorio en GitHub (por ejemplo `tienda-gorras`), público.
2. **Add file → Upload files** y arrastre **el contenido** de esta carpeta (no la carpeta en sí). Commit.
3. **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save.**
4. En 1–2 minutos el sitio queda en `https://SU-USUARIO.github.io/tienda-gorras/`.

> Para probar en su equipo basta con abrir `index.html` con doble clic: el catálogo carga sin servidor.
> Importante: suba **el contenido** de la carpeta, de modo que `index.html` quede en la raíz del repositorio junto a las carpetas `css`, `js`, `data` e `img`.

## Personalizar (`js/config.js`)

- `breb.llave` y `breb.tipoLlave`: la llave Bre-B registrada en su banco (celular, correo, cédula o alfanumérica) y `breb.titular`.
- `whatsapp`: número en formato internacional sin `+` (ya está `573103024205`).
- `correo`, `redes`, `ciudad`, costo y umbral de envío gratis, `stockBajo`.
- `claveAdmin`: **cámbiela** antes de publicar.

Productos: edítelos en el panel o directamente en `data/inventario.js`. Para fotos reales súbalas a `img/` y ponga la ruta en el campo `imagen` (ej. `img/trucker-negra.jpg`).

## Cómo funciona el inventario automático

Al confirmar el pago, el sitio **verifica** que haya stock de cada referencia, **descuenta** las unidades, **suma** las ventas, registra el pedido y el movimiento. Si alguien intenta comprar más de lo disponible, se bloquea.

Hay dos modos:

**Modo local (por defecto, sin configurar nada).** GitHub Pages solo sirve archivos; no tiene base de datos. El stock se descuenta en el navegador donde se hace la compra. El administrador ajusta el inventario en el panel y lo publica para todos con **Respaldo → Descargar inventario.js** y reemplazando `data/inventario.js` en GitHub. Sirve para empezar, pero cada cliente ve el inventario publicado, no el de otros clientes en tiempo real.

**Modo Google Sheets (recomendado para vender).** Inventario único y en tiempo real para todos los visitantes; cada venta descuenta stock en la hoja con bloqueo para evitar sobreventas, y los pedidos quedan en la hoja «Pedidos». Configuración (10 minutos):

1. Cree una hoja de cálculo de Google → **Extensiones → Apps Script**.
2. Pegue el contenido de `google-apps-script/Code.gs`. Cambie `CLAVE_ADMIN` para que coincida con `claveAdmin`.
3. Seleccione la función `inicializar` → **Ejecutar** → autorice. Se crean las hojas Inventario, Pedidos y Movimientos.
4. **Implementar → Nueva implementación → tipo Aplicación web**, ejecutar como *Yo*, acceso *Cualquier usuario* → copie la URL que termina en `/exec`.
5. Péguela en `sheetsUrl` de `js/config.js` y súbalo a GitHub. El panel mostrará «Google Sheets · en línea».

Desde ese momento también puede editar el stock directamente en la hoja de Google.

## Sobre el pago Bre-B

Bre-B es el sistema de pagos inmediatos del Banco de la República; las transferencias se hacen desde la app del banco o billetera del cliente, no desde el sitio. Por eso el flujo es: el sitio muestra la llave y el valor exacto, el cliente transfiere, escribe el número de comprobante y envía el pedido por WhatsApp adjuntando el pantallazo. **Verifique siempre en su banco que el dinero llegó** antes de despachar, y marque el pedido como «Pago verificado» en el panel.

## Seguridad

La clave del panel está en un archivo público (`config.js`), así que es una protección básica que solo evita accesos casuales. En modo local nadie puede alterar el inventario de otros. En modo Sheets, la clave protege las ediciones; para más seguridad use una clave larga y no la comparta, o edite el inventario directamente en Google Sheets.
