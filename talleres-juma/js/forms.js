/* ==========================================================================
   Talleres Juma — forms.js
   Feedback de contacto: toast de confirmación al usar WhatsApp/llamar/copiar
   ========================================================================== */

(function () {
  "use strict";

  var toastEl = document.getElementById("toast");
  var toastTimer;

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 3200);
  }

  // ---------- WhatsApp: confirmación al abrir el chat ----------
  document.querySelectorAll('a[href*="wa.me"]').forEach(function (link) {
    link.addEventListener("click", function () {
      showToast("Abriendo WhatsApp: (809) 296-2300");
    });
  });

  // ---------- Teléfono: en escritorio no se puede llamar, copiamos el número ----------
  var isTouch = window.matchMedia("(hover: none)").matches;
  document.querySelectorAll('a[href^="tel:"]').forEach(function (link) {
    if (isTouch) return;
    link.addEventListener("click", function (e) {
      var number = link.getAttribute("href").replace("tel:", "");
      if (navigator.clipboard) {
        e.preventDefault();
        navigator.clipboard
          .writeText(number)
          .then(function () {
            showToast("Número copiado: " + number);
          })
          .catch(function () {
            showToast("Llámanos al " + number);
          });
      }
    });
  });

  // ---------- Redes sociales ----------
  var socialToasts = {
    "instagram.com": "Abriendo Instagram @talleres_juma",
    "facebook.com": "Abriendo Facebook de Talleres Juma",
    "google.com/maps": "Abriendo la ubicación en Google Maps"
  };

  document.querySelectorAll('a[target="_blank"]').forEach(function (link) {
    var href = link.getAttribute("href") || "";
    Object.keys(socialToasts).forEach(function (key) {
      if (href.indexOf(key) !== -1) {
        link.addEventListener("click", function () {
          showToast(socialToasts[key]);
        });
      }
    });
  });
})();
