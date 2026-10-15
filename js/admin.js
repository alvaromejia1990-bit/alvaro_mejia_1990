/* ============================================================
   PANEL ADMINISTRATIVO DE INVENTARIO
   ============================================================ */
(() => {
  const CFG = window.TIENDA_CONFIG;
  const $ = s => document.querySelector(s);
  const K_SES = "capsula_admin_sesion";
  const ESTADOS = ["Pago reportado", "Enviado por WhatsApp", "Pago verificado", "Despachado", "Entregado", "Cancelado"];

  const toast = (m, t = "") => { const x = $("#toast"); x.textContent = m; x.className = "toast show " + t; clearTimeout(x._t); x._t = setTimeout(() => x.className = "toast", 3000); };
  const fecha = iso => new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
  const descargar = (nombre, texto, tipo) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([texto], { type: tipo })); a.download = nombre; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const csv = filas => "﻿" + filas.map(f => f.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");

  /* ---------- Acceso ---------- */
  const entrar = async () => {
    $("#login").hidden = true; $("#admin").hidden = false;
    await Inventario.cargar(); pintar();
  };
  if (sessionStorage.getItem(K_SES) === "1") entrar();
  $("#formLogin").addEventListener("submit", e => {
    e.preventDefault();
    if (e.target.clave.value === CFG.claveAdmin) { sessionStorage.setItem(K_SES, "1"); entrar(); }
    else toast("Clave incorrecta", "error");
  });
  $("#salir").onclick = () => { sessionStorage.removeItem(K_SES); location.reload(); };
  $("#recargar").onclick = async () => { await Inventario.cargar(); pintar(); toast("Inventario recargado"); };

  /* ---------- Pestañas ---------- */
  document.querySelector(".tabs").addEventListener("click", e => {
    const b = e.target.closest(".tab"); if (!b) return;
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t === b));
    document.querySelectorAll(".panel").forEach(p => p.classList.toggle("on", p.id === "p-" + b.dataset.tab));
  });

  /* ---------- Render ---------- */
  function estadoDe(p) {
    if (p.stock === 0) return ["cero", "Agotado"];
    if (p.stock <= CFG.stockBajo) return ["bajo", "Stock bajo"];
    return ["ok", "Disponible"];
  }

  function pintar() {
    const ps = Inventario.productos, peds = Inventario.pedidos();
    const fuente = $("#fuente");
    fuente.textContent = Inventario.origen === "sheets" ? "Google Sheets · en línea" : "Local · este navegador";
    fuente.className = "fuente " + Inventario.origen;

    const bajos = ps.filter(p => p.activo && p.stock <= CFG.stockBajo);
    const ingresos = peds.filter(p => p.estado !== "Cancelado").reduce((s, p) => s + p.total, 0);
    $("#kpis").innerHTML = [
      ["Referencias", ps.length],
      ["Unidades en stock", ps.reduce((s, p) => s + p.stock, 0)],
      ["Valor del inventario", COP(ps.reduce((s, p) => s + p.stock * p.precio, 0))],
      ["Unidades vendidas", ps.reduce((s, p) => s + p.ventas, 0)],
      ["Pedidos registrados", `${peds.length} · ${COP(ingresos)}`],
      ["Alertas de stock", bajos.length, bajos.length ? "alerta" : ""]
    ].map(([t, v, c = ""]) => `<div class="kpi ${c}"><span>${t}</span><strong>${v}</strong></div>`).join("");

    $("#cats").innerHTML = [...new Set(ps.map(p => p.categoria))].map(c => `<option value="${esc(c)}">`).join("");
    pintarInv(); pintarPed(); pintarMov();
  }

  function pintarInv() {
    const q = $("#filtroInv").value.trim().toLowerCase(), f = $("#filtroEstado").value;
    const lista = Inventario.productos.filter(p =>
      (!q || p.ref.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q)) &&
      (!f || (f === "inactivo" ? !p.activo : estadoDe(p)[0] === f)));
    $("#tablaInv").innerHTML = lista.map(p => {
      const [cls, txt] = estadoDe(p);
      return `<tr class="${cls === "ok" ? "" : "fila-" + cls}" data-ref="${esc(p.ref)}">
        <td><img src="${esc(p.imagen)}" alt="" onerror="this.src='img/placeholder.svg'"></td>
        <td><b>${esc(p.ref)}</b></td>
        <td><input value="${esc(p.nombre)}" data-campo="nombre"><small class="muted">${esc(p.categoria)}</small></td>
        <td><input class="n" type="number" min="0" step="100" value="${p.precio}" data-campo="precio"></td>
        <td><input class="n" type="number" min="0" value="${p.stock}" data-campo="stock"></td>
        <td><div class="acciones"><button class="ico" data-entrada="5">+5</button><button class="ico" data-entrada="10">+10</button><button class="ico" data-entrada="?">+…</button></div></td>
        <td>${p.ventas}</td>
        <td><span class="estado ${cls}">${txt}</span></td>
        <td><input type="checkbox" ${p.activo ? "checked" : ""} data-campo="activo" style="width:20px;height:20px;accent-color:var(--orange)"></td>
        <td><div class="acciones"><button class="ico" data-editar>Editar</button><button class="ico rojo" data-borrar>Eliminar</button></div></td>
      </tr>`;
    }).join("") || `<tr><td colspan="10" class="muted">Sin resultados.</td></tr>`;
  }

  $("#filtroInv").addEventListener("input", pintarInv);
  $("#filtroEstado").addEventListener("change", pintarInv);

  const guardarCambio = async (ref, cambios, nota) => {
    try { await Inventario.actualizar(ref, cambios, nota); pintar(); toast("Inventario actualizado"); }
    catch (e) { toast(e.message, "error"); }
  };

  $("#tablaInv").addEventListener("change", e => {
    const el = e.target.closest("[data-campo]"); if (!el) return;
    const ref = el.closest("tr").dataset.ref, campo = el.dataset.campo;
    const val = campo === "activo" ? el.checked : el.value;
    guardarCambio(ref, { [campo]: val }, campo === "stock" ? "Ajuste manual (conteo)" : "Edición");
  });

  $("#tablaInv").addEventListener("click", async e => {
    const tr = e.target.closest("tr"); if (!tr) return;
    const ref = tr.dataset.ref, p = Inventario.buscar(ref); if (!p) return;
    const ent = e.target.closest("[data-entrada]");
    if (ent) {
      let n = ent.dataset.entrada === "?" ? parseInt(prompt(`¿Cuántas unidades entran de ${p.nombre}?`, "1")) : +ent.dataset.entrada;
      if (n > 0) guardarCambio(ref, { stock: p.stock + n }, `Entrada de mercancía (+${n})`);
    }
    if (e.target.closest("[data-borrar]") && confirm(`¿Eliminar ${p.ref} · ${p.nombre}? Esta acción no se puede deshacer.`)) {
      await Inventario.eliminar(ref); pintar(); toast("Producto eliminado");
    }
    if (e.target.closest("[data-editar]")) editar(p);
  });

  function editar(p) {
    $("#dlgT").textContent = "Editar " + p.ref;
    $("#dlgC").innerHTML = `<form id="formEd" class="form-nuevo">
      <label>Categoría<input name="categoria" value="${esc(p.categoria)}"></label>
      <label>Vendidas<input name="ventas" type="number" min="0" value="${p.ventas}"></label>
      <label class="full">Imagen<input name="imagen" value="${esc(p.imagen)}"></label>
      <label class="full">Descripción<textarea name="descripcion" rows="3">${esc(p.descripcion)}</textarea></label>
      <div class="full"><button class="btn btn-primary">Guardar</button></div></form>`;
    $("#formEd").onsubmit = ev => { ev.preventDefault(); guardarCambio(p.ref, Object.fromEntries(new FormData(ev.target)), "Edición"); dlg.close(); };
    dlg.showModal();
  }

  /* ---------- Nuevo producto ---------- */
  $("#formNuevo").addEventListener("submit", async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    d.ref = d.ref.trim().toUpperCase(); d.activo = true;
    try { await Inventario.agregar(d); e.target.reset(); pintar(); toast(`${d.ref} agregado al inventario`); }
    catch (err) { toast(err.message, "error"); }
  });

  /* ---------- Pedidos ---------- */
  function pintarPed() {
    const peds = Inventario.pedidos();
    $("#tablaPed").innerHTML = peds.map(p => `<tr data-id="${esc(p.id)}">
      <td><b>${esc(p.id)}</b></td><td>${fecha(p.fecha)}</td>
      <td>${esc(p.cliente.nombre)}<br><small class="muted">${esc(p.cliente.telefono)}</small></td>
      <td>${p.items.map(i => `${i.cantidad}× ${esc(i.ref)}`).join("<br>")}</td>
      <td><b>${COP(p.total)}</b></td><td>${esc(p.pago.comprobante)}</td>
      <td><select data-estado style="width:auto;padding:.3rem .5rem">${ESTADOS.map(s => `<option ${s === p.estado ? "selected" : ""}>${s}</option>`).join("")}</select></td>
      <td><div class="acciones"><button class="ico" data-ver>Ver</button><a class="ico" target="_blank" rel="noopener" href="https://wa.me/${String(p.cliente.telefono).replace(/\D/g, "").replace(/^(3\d{9})$/, "57$1")}">WhatsApp</a></div></td>
    </tr>`).join("") || `<tr><td colspan="8" class="muted">Aún no hay pedidos registrados en este navegador.</td></tr>`;
  }

  $("#tablaPed").addEventListener("change", async e => {
    const s = e.target.closest("[data-estado]"); if (!s) return;
    const id = s.closest("tr").dataset.id, p = Inventario.pedidos().find(x => x.id === id);
    // Si se cancela un pedido, el stock vuelve al inventario
    if (s.value === "Cancelado" && p.estado !== "Cancelado" && confirm("¿Devolver las unidades de este pedido al inventario?")) {
      for (const it of p.items) {
        const prod = Inventario.buscar(it.ref);
        if (prod) await Inventario.actualizar(it.ref, { stock: prod.stock + it.cantidad, ventas: Math.max(0, prod.ventas - it.cantidad) }, `Devolución ${id}`);
      }
    }
    Inventario.actualizarPedido(id, { estado: s.value }); pintar(); toast(`Pedido ${id}: ${s.value}`);
  });

  $("#tablaPed").addEventListener("click", e => {
    if (!e.target.closest("[data-ver]")) return;
    const p = Inventario.pedidos().find(x => x.id === e.target.closest("tr").dataset.id), c = p.cliente;
    $("#dlgT").textContent = p.id;
    $("#dlgC").innerHTML = `<pre>${esc(
`Fecha: ${fecha(p.fecha)}
Estado: ${p.estado}

${p.items.map(i => `${i.cantidad} × ${i.nombre} (${i.ref}) — ${COP(i.subtotal)}`).join("\n")}

Subtotal: ${COP(p.subtotal)}
Envío: ${COP(p.envio)}
TOTAL: ${COP(p.total)}

Pago Bre-B · comprobante ${p.pago.comprobante}

${c.nombre}
${c.correo} · ${c.telefono}
${c.direccion}, ${c.ciudad}
Adicional: ${c.adicional || "—"}`)}</pre>`;
    dlg.showModal();
  });

  /* ---------- Movimientos ---------- */
  function pintarMov() {
    $("#tablaMov").innerHTML = Inventario.movimientos().map(m => `<tr>
      <td>${fecha(m.fecha)}</td><td>${esc(m.ref)}</td><td>${esc(m.tipo)}</td>
      <td style="font-weight:700;color:${m.cantidad < 0 ? "#b3261e" : m.cantidad > 0 ? "var(--green)" : "inherit"}">${m.cantidad > 0 ? "+" : ""}${m.cantidad}</td>
      <td>${esc(m.nota)}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">Sin movimientos todavía.</td></tr>`;
  }

  /* ---------- Respaldo ---------- */
  $("#expJson").onclick = () => descargar("inventario.js",
    "/* BASE DE INVENTARIOS — exportada desde el panel administrativo */\nwindow.INVENTARIO_BASE = " +
    JSON.stringify({ version: 1, actualizado: new Date().toISOString().slice(0, 16), productos: Inventario.productos }, null, 2) + ";\n",
    "text/javascript");
  $("#expCsv").onclick = () => descargar("inventario.csv", csv([
    ["Referencia", "Nombre", "Categoría", "Precio", "Stock", "Vendidas", "Activo", "Imagen", "Descripción"],
    ...Inventario.productos.map(p => [p.ref, p.nombre, p.categoria, p.precio, p.stock, p.ventas, p.activo ? "SI" : "NO", p.imagen, p.descripcion])
  ]), "text/csv");
  $("#expPed").onclick = () => descargar("pedidos.csv", csv([
    ["Pedido", "Fecha", "Estado", "Cliente", "Correo", "Teléfono", "Dirección", "Ciudad", "Adicional", "Productos", "Subtotal", "Envío", "Total", "Comprobante Bre-B"],
    ...Inventario.pedidos().map(p => [p.id, fecha(p.fecha), p.estado, p.cliente.nombre, p.cliente.correo, p.cliente.telefono, p.cliente.direccion, p.cliente.ciudad, p.cliente.adicional,
      p.items.map(i => `${i.cantidad}x ${i.ref}`).join(", "), p.subtotal, p.envio, p.total, p.pago.comprobante])
  ]), "text/csv");
  $("#impJson").onchange = async e => {
    try {
      // Acepta .json o el inventario.js exportado
      const raw = await e.target.files[0].text();
      const txt = raw.slice(raw.search(/[\[{]/)).replace(/;\s*$/, "");
      const j = JSON.parse(txt);
      const lista = Array.isArray(j) ? j : j.productos;
      if (!Array.isArray(lista)) throw new Error("Formato no válido");
      Inventario.importar(lista); pintar(); toast(`${lista.length} productos importados`);
    } catch (err) { toast("No se pudo importar: " + err.message, "error"); }
    e.target.value = "";
  };
  $("#reset").onclick = async () => {
    if (!confirm("Se descartarán los cambios locales y se cargará data/inventario.js publicado en GitHub. ¿Continuar?")) return;
    await Inventario.restablecer(); pintar(); toast("Inventario restablecido");
  };
})();
