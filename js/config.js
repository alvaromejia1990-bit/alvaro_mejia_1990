/* ============================================================
   CONFIGURACIÓN DE LA TIENDA — edite solo este archivo
   ============================================================ */
window.TIENDA_CONFIG = {
  nombre: "CAPSULA",
  eslogan: "Gorras nivel arcade",

  // WhatsApp (formato internacional, sin + ni espacios)
  whatsapp: "573103024205",
  whatsappVisible: "+57 310 302 4205",

  // Pago Bre-B: llave registrada en su banco (celular, correo, documento o alfanumérica)
  breb: {
    llave: "3103024205",
    tipoLlave: "Celular",
    titular: "CAPSULA Gorras",
    banco: "Su banco / billetera"
  },

  correo: "ventas@capsula-gorras.co",
  ciudad: "Girardot, Cundinamarca",
  redes: {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    tiktok: "https://tiktok.com/"
  },

  envio: { costo: 12000, gratisDesde: 150000 },   // COP
  stockBajo: 5,                                    // alerta de inventario

  // Clave del panel administrativo (cámbiela). Ver README: es una protección básica.
  claveAdmin: "admin2026",

  // OPCIONAL: URL de la aplicación web de Google Apps Script (inventario compartido en Google Sheets).
  // Déjelo vacío para usar el inventario local (data/inventario.js + navegador).
  sheetsUrl: ""
};
