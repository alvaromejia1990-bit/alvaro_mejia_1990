/* ============================================================
   MÓDULO DE INVENTARIO
   Fuente de datos, en orden de prioridad:
   1) Google Sheets (si TIENDA_CONFIG.sheetsUrl está definido) — compartido entre todos.
   2) Copia local en el navegador (localStorage) — cambios hechos en este equipo.
   3) data/inventario.js — base publicada en GitHub.
   ============================================================ */
const Inventario = (() => {
  const CFG = window.TIENDA_CONFIG;
  const K_PROD = "capsula_inventario_v1";
  const K_BASE = "capsula_base_version";
  const K_PED = "capsula_pedidos_v1";
  const K_MOV = "capsula_movimientos_v1";

  const leer = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  let productos = [];
  let origen = "local";

  async function remoto(accion, datos = {}) {
    const r = await fetch(CFG.sheetsUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },   // evita preflight CORS
      body: JSON.stringify({ accion, ...datos })
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "Error en Google Sheets");
    return j;
  }

  async function cargar() {
    if (CFG.sheetsUrl) {
      try {
        const r = await fetch(CFG.sheetsUrl + "?accion=productos");
        const j = await r.json();
        if (j.ok) { productos = j.productos.map(normalizar); origen = "sheets"; return productos; }
      } catch (e) { console.warn("Sheets no disponible, uso inventario local", e); }
    }
    // La base viene de data/inventario.js (cargado con <script>), así funciona
    // tanto en GitHub Pages como abriendo index.html con doble clic.
    const base = window.INVENTARIO_BASE;
    if (!base || !Array.isArray(base.productos)) throw new Error("No se encontró data/inventario.js");
    const local = leer(K_PROD, null);
    // Si se publicó una base nueva en GitHub (fecha distinta), se toma esa como punto de partida.
    if (local && leer(K_BASE, "") === base.actualizado) productos = local;
    else { productos = base.productos; guardar(K_BASE, base.actualizado); guardar(K_PROD, productos); }
    productos = productos.map(normalizar);
    origen = "local";
    return productos;
  }

  const normalizar = p => ({
    ref: String(p.ref), nombre: p.nombre || "", categoria: p.categoria || "", descripcion: p.descripcion || "",
    precio: Number(p.precio) || 0, stock: Math.max(0, parseInt(p.stock) || 0), ventas: parseInt(p.ventas) || 0,
    imagen: p.imagen || "img/placeholder.svg", activo: p.activo !== false && p.activo !== "FALSE"
  });

  const persistir = () => guardar(K_PROD, productos);
  const buscar = ref => productos.find(p => p.ref === ref);

  function movimiento(ref, tipo, cantidad, nota = "") {
    const m = leer(K_MOV, []);
    m.unshift({ fecha: new Date().toISOString(), ref, tipo, cantidad, nota });
    guardar(K_MOV, m.slice(0, 500));
  }

  /* Verifica que cada línea del carrito tenga stock suficiente. */
  function verificar(items) {
    const errores = [];
    items.forEach(it => {
      const p = buscar(it.ref);
      if (!p || !p.activo) errores.push(`${it.ref} ya no está disponible`);
      else if (p.stock < it.cantidad) errores.push(`${p.nombre}: solo quedan ${p.stock}`);
    });
    return errores;
  }

  /* Registra el pedido: descuenta stock, suma ventas y guarda el pedido. */
  async function registrarPedido(pedido) {
    if (origen === "sheets") {
      const j = await remoto("pedido", { pedido });
      productos = j.productos.map(normalizar);
    } else {
      const err = verificar(pedido.items);
      if (err.length) throw new Error(err.join("\n"));
      pedido.items.forEach(it => {
        const p = buscar(it.ref);
        p.stock -= it.cantidad; p.ventas += it.cantidad;
        movimiento(it.ref, "venta", -it.cantidad, pedido.id);
      });
      persistir();
    }
    const ped = leer(K_PED, []); ped.unshift(pedido); guardar(K_PED, ped);
    return pedido;
  }

  /* ---------- Operaciones administrativas ---------- */
  async function actualizar(ref, cambios, nota = "Ajuste manual") {
    const p = buscar(ref); if (!p) return;
    const antes = p.stock;
    Object.assign(p, normalizar({ ...p, ...cambios }));
    if (p.stock !== antes) movimiento(ref, p.stock > antes ? "entrada" : "salida", p.stock - antes, nota);
    persistir();
    if (origen === "sheets") await remoto("actualizar", { clave: CFG.claveAdmin, producto: p });
  }

  async function agregar(prod) {
    if (buscar(prod.ref)) throw new Error("Ya existe un producto con esa referencia");
    const p = normalizar(prod); productos.push(p);
    movimiento(p.ref, "alta", p.stock, "Producto nuevo"); persistir();
    if (origen === "sheets") await remoto("actualizar", { clave: CFG.claveAdmin, producto: p });
  }

  async function eliminar(ref) {
    productos = productos.filter(p => p.ref !== ref);
    movimiento(ref, "baja", 0, "Producto eliminado"); persistir();
    if (origen === "sheets") await remoto("eliminar", { clave: CFG.claveAdmin, ref });
  }

  function importar(lista) { productos = lista.map(normalizar); persistir(); movimiento("*", "importación", 0, `${lista.length} productos`); }
  async function restablecer() { localStorage.removeItem(K_PROD); localStorage.removeItem(K_BASE); return cargar(); }

  function actualizarPedido(id, cambios) {
    const ped = leer(K_PED, []); const p = ped.find(x => x.id === id);
    if (p) { Object.assign(p, cambios); guardar(K_PED, ped); }
  }

  return {
    cargar, verificar, registrarPedido, actualizar, agregar, eliminar, importar, restablecer, actualizarPedido,
    get productos() { return productos; }, get origen() { return origen; },
    pedidos: () => leer(K_PED, []), movimientos: () => leer(K_MOV, []), buscar
  };
})();

const COP = n => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
