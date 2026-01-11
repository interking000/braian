/* ============================================================
   utils.js (KING•VPN TOAST PRO - SAFE)
   - SIN ?.  SIN ??  SIN spread
   - Toastify por className + CSS inyectado (no queda verde nunca)
   - Mantiene nombres y firma de tus funciones
   ============================================================ */

console.log("KING•VPN utils cargado ✅", new Date().toISOString());

/* ---------- Helpers DOM ---------- */
const hideElement = (element) => {
    if (!element) return;
    element.style.display = 'none';
}

const showElement = (element) => {
    if (!element) return;
    element.style.removeProperty('display');
}

const showElements = (elements) => {
    if (!elements || !elements.forEach) return;
    elements.forEach(showElement);
}

const setRequired = (element, isRequired) => {
    if (!element) return;
    if (isRequired) {
        element.setAttribute('required', isRequired);
    } else {
        element.removeAttribute('required');
    }
}

const setRequiredElements = (elements, isRequired) => {
    if (!elements || !elements.forEach) return;
    elements.forEach(element => setRequired(element, isRequired));
}

/* ---------- CSRF ---------- */
const getCsrfTokenHead = () => {
    var meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : null;
};
const getCsrfTokenRefresh = (request) => {
    try { return request.headers.get('csrf-token'); } catch (e) { return null; }
};

/* ---------- Search ---------- */
const doSearch = (e) => {
    let searchEl = document.getElementById('search');
    let search = searchEl ? searchEl.value : '';
    let attr = e.getAttribute('href');

    if (attr.indexOf('search') > -1) {
        let split = attr.split('&');
        for (let i = 0; i < split.length; i++) {
            if (split[i].indexOf('search') > -1) {
                split[i] = 'search=' + search;
            }
        }
        attr = split.join('&');
    } else {
        attr += '&search=' + search;
    }
    e.setAttribute('href', attr);
}

/* ============================================================
   ✅ KING TOAST CSS (inyectado 1 vez)
   ============================================================ */
(function injectKingToastCssOnce(){
    try {
        if (document.getElementById('king-toast-css')) return;

        var css = document.createElement('style');
        css.id = 'king-toast-css';
        css.innerHTML =
        `
        .toastify.king-toast{
          border-radius: 14px !important;
          padding: 12px 14px !important;
          font-weight: 900 !important;
          letter-spacing: .06em !important;
          text-transform: uppercase !important;
          font-size: 12px !important;
          border: 1px solid rgba(167,139,250,.20) !important;
          box-shadow: 0 14px 34px rgba(0,0,0,.55), 0 0 0 1px rgba(34,197,94,.06) !important;
          backdrop-filter: blur(10px) !important;
          -webkit-backdrop-filter: blur(10px) !important;
          max-width: 78vw !important;
          min-width: 260px !important;
        }

        /* Variantes KING */
        .toastify.king-success{
          background:
            radial-gradient(240px 80px at 18% 30%, rgba(34,197,94,.22), transparent 62%),
            radial-gradient(260px 90px at 82% 30%, rgba(139,92,246,.16), transparent 65%),
            rgba(7,10,18,.92) !important;
          border-color: rgba(34,197,94,.24) !important;
          box-shadow: 0 14px 34px rgba(0,0,0,.55), 0 0 0 1px rgba(34,197,94,.10), 0 0 22px rgba(34,197,94,.10) !important;
        }

        .toastify.king-error{
          background:
            radial-gradient(240px 80px at 18% 30%, rgba(239,68,68,.22), transparent 62%),
            radial-gradient(260px 90px at 82% 30%, rgba(139,92,246,.12), transparent 65%),
            rgba(7,10,18,.92) !important;
          border-color: rgba(239,68,68,.26) !important;
          box-shadow: 0 14px 34px rgba(0,0,0,.55), 0 0 0 1px rgba(239,68,68,.10), 0 0 22px rgba(239,68,68,.10) !important;
        }

        .toastify.king-warning{
          background:
            radial-gradient(240px 80px at 18% 30%, rgba(245,158,11,.22), transparent 62%),
            radial-gradient(260px 90px at 82% 30%, rgba(34,197,94,.10), transparent 65%),
            rgba(7,10,18,.92) !important;
          border-color: rgba(245,158,11,.26) !important;
          box-shadow: 0 14px 34px rgba(0,0,0,.55), 0 0 0 1px rgba(245,158,11,.10), 0 0 22px rgba(245,158,11,.10) !important;
        }

        .toastify.king-info{
          background:
            radial-gradient(240px 80px at 18% 30%, rgba(139,92,246,.22), transparent 62%),
            radial-gradient(260px 90px at 82% 30%, rgba(34,197,94,.10), transparent 65%),
            rgba(7,10,18,.92) !important;
          border-color: rgba(167,139,250,.26) !important;
          box-shadow: 0 14px 34px rgba(0,0,0,.55), 0 0 0 1px rgba(167,139,250,.10), 0 0 22px rgba(167,139,250,.10) !important;
        }
        `;
        document.head.appendChild(css);
    } catch (e) {}
})();

/* ============================================================
   ✅ Toastify wrapper (clase + posición)
   ============================================================ */
function __kingToast(message, variant) {
    if (typeof Toastify !== 'function') {
        try { console.log('[Toastify missing]', message); } catch (e) {}
        return;
    }

    // Si querés cambiar posición:
    // - "right" (actual)
    // - "center" (más pro en móvil)
    var position = "right"; // <-- CAMBIÁ a "center" si querés

    Toastify({
        text: message,
        duration: 2400,
        close: true,
        gravity: "top",
        position: position,
        stopOnFocus: true,
        className: "king-toast " + variant
    }).showToast();
}

/* ---------- API pública (mismos nombres) ---------- */
const showToastSuccess = (message) => __kingToast("✅ " + message, "king-success");
const showToastError   = (message) => __kingToast("⛔ " + message, "king-error");
const showToastWarning = (message) => __kingToast("⚠️ " + message, "king-warning");
const showToastInfo    = (message) => __kingToast("⏳ " + message, "king-info");

/* ---------- Upload imagen (igual lógica) ---------- */
const uploadImage = async (e, element) => {
    showToastInfo('Aguarde, enviando imagen...');

    const form = new FormData();
    form.append('file', e.files[0]);

    const response = await fetch('/upload/image', {
        method: 'POST',
        body: form
    });

    const data = await response.json();
    if (data.status == 200) {
        showToastSuccess('Genial! Imagen enviada con exito!');
        if (element) element.value = data.url;
        return data.url;
    }

    if (data.message) {
        showToastError(data.message);
        return;
    }

    showToastError('Error! No fue posible enviar la imagem!');
}

/* ---------- Copy (igual) ---------- */
const copyToClipboard = data => {
    var $temp = $("<textarea>");
    $("body").append($temp);
    $temp.val(data).select();
    document.execCommand("copy");
    $temp.remove();
}

/* ---------- Confirm (igual lógica vieja) ---------- */
const showAlertConfirm = (callback, message) => {
    Swal.fire({
        title: '¿Estás seguro?',
        text: message || 'Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#22c55e',
        cancelButtonColor: '#ef4444',
        confirmButtonText: 'Sí, continuar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        width: '25rem',
        background: 'rgba(7,10,18,.94)',
        color: '#EAF0FF'
    }).then((result) => {
        if (result.value) {
            callback();
        }
    })
}
