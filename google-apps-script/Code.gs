/**
 * INVENTARIO COMPARTIDO EN GOOGLE SHEETS — CAPSULA
 * ------------------------------------------------
 * 1. Cree una hoja de cálculo de Google nueva.
 * 2. Extensiones → Apps Script → pegue este archivo completo.
 * 3. Cambie CLAVE_ADMIN (debe ser igual a claveAdmin en js/config.js).
 * 4. Ejecute una vez la función `inicializar` (autorice los permisos).
 * 5. Implementar → Nueva implementación → Aplicación web
 *      Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier usuario
 * 6. Copie la URL /exec y péguela en sheetsUrl de js/config.js.
 */
const CLAVE_ADMIN = "admin2026";
const COLS = ["ref", "nombre", "categoria", "descripcion", "precio", "stock", "ventas", "imagen", "activo"];

function hoja_(nombre) { return SpreadsheetApp.getActive().getSheetByName(nombre); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function inicializar() {
  const ss = SpreadsheetApp.getActive();
  let inv = hoja_("Inventario");
  if (!inv) {
    inv = ss.insertSheet("Inventario");
    inv.appendRow(COLS);
    [
      ["CAP-001", "Trucker Noche Neón", "Trucker", "Copa negra, malla cian y parche magenta. Cierre snapback.", 69000, 24, 38, "img/gorra-001.svg", true],
      ["CAP-002", "Dad Hat Moneda", "Dad hat", "Amarillo moneda con visera naranja. Algodón lavado, correa ajustable.", 59000, 15, 52, "img/gorra-002.svg", true],
      ["CAP-003", "Snapback Láser", "Snapback", "Verde láser, visera plana y copa estructurada con parche bordado.", 75000, 9, 21, "img/gorra-003.svg", true],
      ["CAP-004", "Trucker Volcán", "Trucker", "Copa roja, malla crema y visera negra. Malla transpirable.", 69000, 4, 44, "img/gorra-004.svg", true],
      ["CAP-005", "Dad Hat Galaxia", "Dad hat", "Morado galaxia con franja cian bordada. Perfil bajo.", 59000, 18, 17, "img/gorra-005.svg", true],
      ["CAP-006", "Snapback Marino Oro", "Snapback", "Azul eléctrico con visera dorada. Edición especial.", 85000, 6, 29, "img/gorra-006.svg", true],
      ["CAP-007", "Classic Blanco Pixel", "Dad hat", "Blanco con franja cian y parche magenta. Algodón 100 %.", 55000, 30, 61, "img/gorra-007.svg", true],
      ["CAP-008", "Trucker Arcade", "Trucker", "Cian, magenta y malla amarilla. La más ruidosa del catálogo.", 72000, 0, 33, "img/gorra-008.svg", true]
    ].forEach(r => inv.appendRow(r));
    inv.setFrozenRows(1);
  }
  if (!hoja_("Pedidos")) {
    const p = ss.insertSheet("Pedidos");
    p.appendRow(["Pedido", "Fecha", "Estado", "Cliente", "Correo", "Teléfono", "Dirección", "Ciudad", "Adicional", "Productos", "Subtotal", "Envío", "Total", "Comprobante Bre-B"]);
    p.setFrozenRows(1);
  }
  if (!hoja_("Movimientos")) {
    const m = ss.insertSheet("Movimientos");
    m.appendRow(["Fecha", "Ref", "Tipo", "Cantidad", "Nota"]);
    m.setFrozenRows(1);
  }
}

function leerProductos_() {
  const v = hoja_("Inventario").getDataRange().getValues();
  const h = v.shift();
  return v.filter(r => r[0] !== "").map(r => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}

function filaDe_(ref) {
  const refs = hoja_("Inventario").getRange("A:A").getValues().flat().map(String);
  const i = refs.indexOf(String(ref));
  return i < 1 ? -1 : i + 1;
}

function mov_(ref, tipo, cant, nota) { hoja_("Movimientos").appendRow([new Date(), ref, tipo, cant, nota]); }

function doGet(e) {
  return json_({ ok: true, productos: leerProductos_() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);                       // evita que dos ventas simultáneas sobrevendan
  try {
    const d = JSON.parse(e.postData.contents);
    const inv = hoja_("Inventario");
    const cStock = COLS.indexOf("stock") + 1, cVentas = COLS.indexOf("ventas") + 1;

    if (d.accion === "pedido") {
      const p = d.pedido;
      // 1) verificar disponibilidad
      for (const it of p.items) {
        const f = filaDe_(it.ref);
        if (f < 0) return json_({ ok: false, error: it.ref + " ya no existe" });
        const stock = Number(inv.getRange(f, cStock).getValue());
        if (stock < it.cantidad) return json_({ ok: false, error: it.nombre + ": solo quedan " + stock });
      }
      // 2) descontar stock y sumar ventas
      for (const it of p.items) {
        const f = filaDe_(it.ref);
        inv.getRange(f, cStock).setValue(Number(inv.getRange(f, cStock).getValue()) - it.cantidad);
        inv.getRange(f, cVentas).setValue(Number(inv.getRange(f, cVentas).getValue()) + it.cantidad);
        mov_(it.ref, "venta", -it.cantidad, p.id);
      }
      const c = p.cliente;
      hoja_("Pedidos").appendRow([p.id, new Date(p.fecha), p.estado, c.nombre, c.correo, c.telefono, c.direccion, c.ciudad, c.adicional,
        p.items.map(i => i.cantidad + "x " + i.ref).join(", "), p.subtotal, p.envio, p.total, p.pago.comprobante]);
      return json_({ ok: true, productos: leerProductos_() });
    }

    if (d.clave !== CLAVE_ADMIN) return json_({ ok: false, error: "Clave administrativa inválida" });

    if (d.accion === "actualizar") {
      const pr = d.producto, fila = COLS.map(k => pr[k]);
      const f = filaDe_(pr.ref);
      if (f < 0) inv.appendRow(fila); else inv.getRange(f, 1, 1, COLS.length).setValues([fila]);
      return json_({ ok: true });
    }
    if (d.accion === "eliminar") {
      const f = filaDe_(d.ref);
      if (f > 0) inv.deleteRow(f);
      mov_(d.ref, "baja", 0, "Eliminado desde el panel");
      return json_({ ok: true });
    }
    return json_({ ok: false, error: "Acción desconocida" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
