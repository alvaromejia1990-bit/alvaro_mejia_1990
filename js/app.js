/* ============================================================
   TIENDA — catálogo, carrito, checkout Bre-B y WhatsApp
   ============================================================ */
(() => {
  const CFG = window.TIENDA_CONFIG;
  const $ = s => document.querySelector(s);
  const K_CART = "capsula_carrito_v1";
  let carrito = (() => { try { return JSON.parse(localStorage.getItem(K_CART)) || []; } catch { return []; } })();
  let filtro = "Todas";
  let cliente = null, pedidoActual = null;

  /* ---------- Configuración en pantalla ---------- */
  document.querySelectorAll("[data-cfg]").forEach(el => el.textContent = CFG[el.dataset.cfg] ?? "");
  $("#envioGratis").textContent = "desde " + COP(CFG.envio.gratisDesde);
  $("#brebLlave").textContent = CFG.breb.llave;
  $("#brebTipo").textContent = "Llave tipo " + CFG.breb.tipoLlave;
  $("#brebTitular").textContent = CFG.breb.titular;
  $("#lnkWA").href = `https://wa.me/${CFG.whatsapp}`;
  $("#lnkMail").href = `mailto:${CFG.correo}`;
  $("#lnkIG").href = CFG.redes.instagram; $("#lnkFB").href = CFG.redes.facebook; $("#lnkTT").href = CFG.redes.tiktok;

  const toast = (msg, tipo = "") => {
    const t = $("#toast"); t.textContent = msg; t.className = "toast show " + tipo;
    clearTimeout(t._t); t._t = setTimeout(() => t.className = "toast", 3200);
  };
  const guardarCarrito = () => { try { localStorage.setItem(K_CART, JSON.stringify(carrito)); } catch {} };

  /* ---------- Catálogo ---------- */
  function pintarChips() {
    const cats = ["Todas", ...new Set(Inventario.productos.filter(p => p.activo).map(p => p.categoria))];
    $("#chips").innerHTML = cats.map(c => `<button class="chip ${c === filtro ? "on" : ""}" data-c="${esc(c)}">${esc(c)}</button>`).join("");
  }

  function pintarCatalogo() {
    const q = $("#buscar").value.trim().toLowerCase();
    const orden = $("#orden").value;
    let lista = Inventario.productos.filter(p => p.activo &&
      (filtro === "Todas" || p.categoria === filtro) &&
      (!q || p.nombre.toLowerCase().includes(q) || p.ref.toLowerCase().includes(q)));
    const f = { ventas: (a, b) => b.ventas - a.ventas, "precio-asc": (a, b) => a.precio - b.precio,
                "precio-desc": (a, b) => b.precio - a.precio, stock: (a, b) => b.stock - a.stock }[orden];
    lista.sort((a, b) => (a.stock === 0) - (b.stock === 0) || f(a, b));   // agotados al final
    const top = [...Inventario.productos].sort((a, b) => b.ventas - a.ventas)[0]?.ref;
    const maxStock = Math.max(1, ...Inventario.productos.map(p => p.stock));

    $("#grid").innerHTML = lista.length ? lista.map(p => {
      const enCarrito = carrito.find(i => i.ref === p.ref)?.cantidad || 0;
      const disp = p.stock - enCarrito;
      const estado = p.stock === 0 ? `<span class="tag agotado">Agotado</span>`
        : p.stock <= CFG.stockBajo ? `<span class="tag bajo">¡Últimas ${p.stock}!</span>` : "";
      return `<article class="producto ${p.stock === 0 ? "sin-stock" : ""}">
        <div class="foto">${p.ref === top ? `<span class="tag top">Más vendida</span>` : ""}${estado}
          <img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy" onerror="this.src='img/placeholder.svg'"></div>
        <div class="info">
          <div class="ref">REF ${esc(p.ref)} · ${esc(p.categoria)}</div>
          <h3>${esc(p.nombre)}</h3>
          <p class="desc">${esc(p.descripcion)}</p>
          <dl class="datos">
            <div><dt>En stock</dt><dd>${p.stock} und</dd></div>
            <div><dt>Vendidas</dt><dd>${p.ventas}</dd></div>
          </dl>
          <div class="meter ${p.stock === 0 ? "cero" : p.stock <= CFG.stockBajo ? "bajo" : ""}" title="Disponibilidad">
            ${Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.ceil(Math.min(p.stock, maxStock) / maxStock * 10) ? "on" : ""}"></i>`).join("")}
          </div>
          <div class="comprar">
            <span class="precio">${COP(p.precio)}</span>
            <div class="qty"><button data-q="-1" data-r="${esc(p.ref)}" aria-label="Menos">−</button><input type="number" min="1" max="${Math.max(1, disp)}" value="1" id="q-${esc(p.ref)}" aria-label="Cantidad"><button data-q="1" data-r="${esc(p.ref)}" aria-label="Más">+</button></div>
          </div>
          <button class="btn btn-primary btn-block" data-add="${esc(p.ref)}" ${disp <= 0 ? "disabled" : ""}>
            ${p.stock === 0 ? "Agotado" : disp <= 0 ? "Máximo en carrito" : "Agregar al carrito"}</button>
        </div></article>`;
    }).join("") : `<p class="cargando">No hay gorras que coincidan con tu búsqueda.</p>`;

    $("#statModelos").textContent = Inventario.productos.filter(p => p.activo).length;
    const vendidas = Inventario.productos.reduce((s, p) => s + p.ventas, 0);
    $("#statVendidas").textContent = vendidas;
    $("#hudHi").textContent = String(vendidas).padStart(6, "0");
  }

  $("#chips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; filtro = b.dataset.c; pintarChips(); pintarCatalogo(); });
  $("#buscar").addEventListener("input", pintarCatalogo);
  $("#orden").addEventListener("change", pintarCatalogo);

  $("#grid").addEventListener("click", e => {
    const q = e.target.closest("[data-q]");
    if (q) { const inp = $("#q-" + CSS.escape(q.dataset.r)); const v = (+inp.value || 1) + (+q.dataset.q); inp.value = Math.min(+inp.max, Math.max(1, v)); return; }
    const a = e.target.closest("[data-add]");
    if (a) agregar(a.dataset.add, +$("#q-" + CSS.escape(a.dataset.add)).value || 1);
  });

  /* ---------- Carrito ---------- */
  function agregar(ref, cant) {
    const p = Inventario.buscar(ref); if (!p) return;
    const linea = carrito.find(i => i.ref === ref);
    const actual = linea?.cantidad || 0;
    if (actual + cant > p.stock) { toast(`Solo hay ${p.stock} unidades de ${p.nombre}`, "error"); return; }
    if (linea) linea.cantidad += cant; else carrito.push({ ref, cantidad: cant });
    guardarCarrito(); refrescar(); toast(`${cant} × ${p.nombre} agregada${cant > 1 ? "s" : ""} al carrito`);
  }

  function cambiar(ref, delta) {
    const l = carrito.find(i => i.ref === ref); const p = Inventario.buscar(ref); if (!l || !p) return;
    l.cantidad = Math.min(p.stock, l.cantidad + delta);
    if (l.cantidad <= 0) carrito = carrito.filter(i => i.ref !== ref);
    guardarCarrito(); refrescar();
  }

  function lineas() {
    // Limpia productos que ya no existen o se agotaron
    carrito = carrito.filter(i => { const p = Inventario.buscar(i.ref); return p && p.activo && p.stock > 0; })
      .map(i => ({ ...i, cantidad: Math.min(i.cantidad, Inventario.buscar(i.ref).stock) }));
    return carrito.map(i => { const p = Inventario.buscar(i.ref); return { ...i, nombre: p.nombre, precio: p.precio, imagen: p.imagen, subtotal: p.precio * i.cantidad }; });
  }

  function totales() {
    const ls = lineas(); const sub = ls.reduce((s, l) => s + l.subtotal, 0);
    const env = sub === 0 || sub >= CFG.envio.gratisDesde ? 0 : CFG.envio.costo;
    return { ls, sub, env, total: sub + env, unidades: ls.reduce((s, l) => s + l.cantidad, 0) };
  }

  function refrescar() {
    const t = totales();
    $("#contador").textContent = t.unidades; $("#contador").classList.toggle("on", t.unidades > 0);
    $("#hudScore").textContent = String(Math.round(t.total / 100)).padStart(6, "0");
    $("#hudCred").textContent = String(t.unidades).padStart(2, "0");
    const filaHTML = l => `<div class="linea">
        <img src="${esc(l.imagen)}" alt="">
        <div><b>${esc(l.nombre)}</b><small>REF ${esc(l.ref)} · ${COP(l.precio)}</small>
          <div class="qty sm"><button data-c="-1" data-r="${esc(l.ref)}">−</button><span>${l.cantidad}</span><button data-c="1" data-r="${esc(l.ref)}">+</button></div></div>
        <b>${COP(l.subtotal)}</b></div>`;
    $("#carritoItems").innerHTML = t.ls.length ? t.ls.map(filaHTML).join("") : `<p class="vacio">Tu carrito está vacío.</p>`;
    $("#resumenItems").innerHTML = t.ls.length ? t.ls.map(filaHTML).join("") : `<p class="vacio">Agrega gorras desde el <a href="#catalogo">catálogo</a>.</p>`;
    $("#dSub").textContent = COP(t.sub);
    const falta = CFG.envio.gratisDesde - t.sub;
    $("#dEnvioMsg").textContent = t.sub === 0 ? "" : falta > 0 ? `Te faltan ${COP(falta)} para envío gratis.` : "¡Tu envío es gratis!";
    $("#tSub").textContent = COP(t.sub); $("#tEnv").textContent = t.env ? COP(t.env) : (t.sub ? "Gratis" : "$0");
    $("#tTot").textContent = COP(t.total); $("#brebMonto").textContent = COP(t.total);
    pintarCatalogo();
  }

  ["#carritoItems", "#resumenItems"].forEach(s => $(s).addEventListener("click", e => {
    const b = e.target.closest("[data-c]"); if (b && !pedidoActual) cambiar(b.dataset.r, +b.dataset.c);
  }));

  const abrir = () => { $("#drawer").classList.add("on"); $("#overlay").classList.add("on"); };
  const cerrar = () => { $("#drawer").classList.remove("on"); $("#overlay").classList.remove("on"); };
  $("#abrirCarrito").onclick = abrir; $("#cerrarCarrito").onclick = cerrar; $("#overlay").onclick = cerrar; $("#irPagar").onclick = cerrar;
  $("#menuBtn").onclick = () => $("#nav").classList.toggle("on");
  $("#nav").addEventListener("click", () => $("#nav").classList.remove("on"));

  /* ---------- Paso 2: datos del cliente ---------- */
  $("#formDatos").addEventListener("submit", e => {
    e.preventDefault();
    const f = e.target;
    if (!totales().ls.length) { toast("Primero agrega gorras al carrito", "error"); location.hash = "catalogo"; return; }
    if (!f.checkValidity()) { f.reportValidity(); return; }
    cliente = Object.fromEntries(new FormData(f));
    $("#pasoPago").classList.remove("bloqueado");
    $("#pasoPago").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("#copiarLlave").onclick = async () => {
    try { await navigator.clipboard.writeText(CFG.breb.llave); toast("Llave Bre-B copiada"); }
    catch { toast("Llave: " + CFG.breb.llave); }
  };

  /* ---------- Paso 3: confirmación de pago Bre-B ---------- */
  $("#formPago").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    if (!cliente) { toast("Completa primero tus datos", "error"); return; }
    if (!f.checkValidity()) { f.reportValidity(); return; }
    const t = totales();
    if (!t.ls.length) { toast("Tu carrito está vacío", "error"); return; }

    const errores = Inventario.verificar(t.ls);
    if (errores.length) { toast(errores.join(" · "), "error"); refrescar(); return; }

    const btn = $("#btnPagar"); btn.disabled = true; btn.textContent = "Registrando…";
    const pedido = {
      id: "PED-" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(),
      fecha: new Date().toISOString(), cliente,
      items: t.ls.map(l => ({ ref: l.ref, nombre: l.nombre, cantidad: l.cantidad, precio: l.precio, subtotal: l.subtotal })),
      subtotal: t.sub, envio: t.env, total: t.total,
      pago: { medio: "Bre-B", comprobante: f.comprobante.value.trim(), llave: CFG.breb.llave },
      estado: "Pago reportado"
    };
    try {
      pedidoActual = await Inventario.registrarPedido(pedido);
    } catch (err) {
      toast(err.message, "error"); btn.disabled = false; btn.textContent = "Confirmar pago"; refrescar(); return;
    }
    const msg = mensajeWhatsApp(pedidoActual);
    $("#mensajeWA").textContent = msg;
    $("#btnWA").href = `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(msg)}`;
    $("#pedidoId").textContent = pedidoActual.id;
    $("#pasoWhatsapp").classList.remove("bloqueado");
    $("#pasoPago").classList.add("hecho"); $("#formDatos").classList.add("hecho");
    btn.textContent = "Pago reportado ✓";
    carrito = []; guardarCarrito(); refrescar();
    $("#pasoWhatsapp").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("#btnWA").addEventListener("click", () => {
    if (pedidoActual) Inventario.actualizarPedido(pedidoActual.id, { estado: "Enviado por WhatsApp" });
  });

  function mensajeWhatsApp(p) {
    const c = p.cliente;
    const items = p.items.map((i, n) => `${n + 1}. ${i.nombre} (REF ${i.ref})\n   ${i.cantidad} × ${COP(i.precio)} = ${COP(i.subtotal)}`).join("\n");
    return [
      `🧢 *NUEVO PEDIDO ${CFG.nombre}*`,
      `Pedido: ${p.id}`,
      `Fecha: ${new Date(p.fecha).toLocaleString("es-CO")}`,
      ``,
      `*Productos*`,
      items,
      ``,
      `Unidades: ${p.items.reduce((s, i) => s + i.cantidad, 0)}`,
      `Subtotal: ${COP(p.subtotal)}`,
      `Envío: ${p.envio ? COP(p.envio) : "Gratis"}`,
      `*TOTAL: ${COP(p.total)}*`,
      ``,
      `*Confirmación de pago*`,
      `✅ Pago realizado por Bre-B a la llave ${p.pago.llave}`,
      `Comprobante: ${p.pago.comprobante}`,
      `Valor pagado: ${COP(p.total)}`,
      ``,
      `*Datos del cliente*`,
      `Nombre: ${c.nombre}`,
      `Correo: ${c.correo}`,
      `Teléfono: ${c.telefono}`,
      `Dirección: ${c.direccion}, ${c.ciudad}`,
      `Información adicional: ${c.adicional || "Ninguna"}`,
      ``,
      `Adjunto el pantallazo del comprobante. ¡Gracias!`
    ].join("\n");
  }

  /* ---------- Contacto ---------- */
  $("#formContacto").addEventListener("submit", e => {
    e.preventDefault();
    const f = e.target; if (!f.checkValidity()) { f.reportValidity(); return; }
    const d = Object.fromEntries(new FormData(f));
    const texto = `Hola ${CFG.nombre}, soy ${d.nombre} (${d.contacto}).\nAsunto: ${d.asunto}\n\n${d.mensaje}`;
    if (e.submitter?.dataset.via === "mail")
      location.href = `mailto:${CFG.correo}?subject=${encodeURIComponent(d.asunto + " — " + d.nombre)}&body=${encodeURIComponent(texto)}`;
    else window.open(`https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
    f.reset(); toast("¡Gracias! Abrimos tu mensaje para enviarlo.");
  });

  /* ---------- Arranque ---------- */
  Inventario.cargar().then(() => { pintarChips(); refrescar(); })
    .catch(err => { $("#grid").innerHTML = `<p class="cargando">No se pudo cargar el inventario: verifica que el archivo data/inventario.js esté en el repositorio.</p>`; console.error(err); });
})();
