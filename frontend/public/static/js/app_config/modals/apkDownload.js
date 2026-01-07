class ApkDownloadModal {
  constructor() {
    // ✅ sufijo para evitar choques de IDs si se crea más de 1 modal
    this._uid = `apk_${Math.random().toString(16).slice(2)}`;

    this._element = document.createElement("div");
    this._element.classList.add("modal", "fade");
    this._element.setAttribute("tabindex", "-1");

    // ✅ IDs únicos
    this._ids = {
      modal: `downloadModal_${this._uid}`,
      appName: `appName_${this._uid}`,
      packageName: `packageName_${this._uid}`,
      logoUrl: `logoUrl_${this._uid}`,
      logoFile: `logoFile_${this._uid}`,
      logoImg: `logoImg_${this._uid}`,
      logoHint: `logoHint_${this._uid}`,
      spinner: `spinnerContainer_${this._uid}`,
      status: `modalStatus_${this._uid}`,
      btnGenerate: `btnGenerateApp_${this._uid}`,
      btnDownload: `btnConfirmDownload_${this._uid}`,

      // ✅ overlay pro
      overlay: `kingOverlay_${this._uid}`,
      progressBar: `kingProgress_${this._uid}`,
      progressText: `kingProgressText_${this._uid}`,
      btnCancelBuild: `btnCancelBuild_${this._uid}`,

      // ✅ NUEVO: modal listo (2do modal)
      readyModal: `readyModal_${this._uid}`,
      readyTitle: `readyTitle_${this._uid}`,
      readyLogo: `readyLogo_${this._uid}`,
      readyName: `readyName_${this._uid}`,
      readyPkg: `readyPkg_${this._uid}`,
      readyBtnClose: `readyClose_${this._uid}`,
      readyBtnDownload: `readyDownload_${this._uid}`,
    };

    this._element.id = this._ids.modal;

    this._element.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content king-modal">
          <div class="modal-header border-0">
            <div class="d-flex align-items-center gap-2">
              <div class="king-badge">
                <i class="bi bi-android2"></i>
              </div>
              <div class="d-flex flex-column">
                <h5 class="modal-title king-title m-0">
                  Generar APK
                </h5>
                <small class="king-sub">Diseño KingVPN • build seguro</small>
              </div>
            </div>

            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>

          <div class="modal-body position-relative">
            <!-- ✅ Overlay de carga PRO (tapado mientras genera) -->
            <div class="king-overlay" id="${this._ids.overlay}" aria-hidden="true">
              <div class="king-overlay-card">
                <div class="king-orbit mb-2">
                  <span></span><span></span><span></span>
                </div>
                <div class="king-overlay-title">Generando tu app…</div>
                <div class="king-overlay-sub" id="${this._ids.progressText}">Preparando recursos</div>

                <div class="king-progress mt-3">
                  <div class="king-progress-bar" id="${this._ids.progressBar}"></div>
                </div>

                <div class="d-flex gap-2 mt-3 w-100">
                  <button type="button" class="btn king-btn-cancel-build w-100" id="${this._ids.btnCancelBuild}">
                    <i class="bi bi-x-circle"></i> Cancelar generación
                  </button>
                </div>

                <div class="king-tip mt-2">
                  <i class="bi bi-shield-check"></i>
                  No cierres esta ventana mientras genera.
                </div>
              </div>
            </div>

            <div class="app-grid mb-2">
              <div>
                <label class="form-label mb-1">Nombre de la app</label>
                <input class="form-control" id="${this._ids.appName}" placeholder="Ej: KINGVPN" value="KINGVPN">
              </div>
              <div>
                <label class="form-label mb-1">Nombre del paquete</label>
                <input class="form-control" id="${this._ids.packageName}" placeholder="Ej: com.kingvpn.app">
              </div>
            </div>

            <div class="app-grid mb-2">
              <div>
                <label class="form-label mb-1">URL del logo (opcional)</label>
                <input class="form-control" id="${this._ids.logoUrl}" placeholder="https://.../logo.png">
              </div>
              <div>
                <label class="form-label mb-1">Importar logo PNG (opcional)</label>
                <input class="form-control" id="${this._ids.logoFile}" type="file" accept="image/png">
              </div>
            </div>

            <div class="logo-preview mb-2">
              <div class="logo-bubble" id="logoBubble_${this._uid}">
                <i class="bi bi-image"></i>
                <img id="${this._ids.logoImg}" alt="Logo preview">
              </div>
              <div class="logo-meta">
                <div class="t1">Preview del logo</div>
                <div class="t2" id="${this._ids.logoHint}">Elegí un PNG o poné una URL</div>
              </div>
            </div>

            <!-- ✅ spinner original (lo dejo por compat, pero el overlay es el pro) -->
            <div id="${this._ids.spinner}">
              <div class="spinner-border" role="status"></div>
            </div>

            <p id="${this._ids.status}" class="text-center king-status">
              Completá los campos y presioná <strong>Generar APK</strong>.
            </p>
          </div>

          <div class="modal-footer border-0 d-flex justify-content-between">
            <button type="button" class="btn king-btn-cancel" data-bs-dismiss="modal">
              <i class="bi bi-x-lg"></i> Cancelar
            </button>

            <div class="d-flex gap-2">
              <button type="button" class="btn king-btn-generate" id="${this._ids.btnGenerate}">
                <i class="bi bi-gear-fill"></i> Generar
              </button>
              <button type="button" class="btn king-btn-download" id="${this._ids.btnDownload}" style="display:none;">
                <i class="bi bi-download"></i> Descargar APK
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // ✅ IMPORTANTE: el modal TIENE que estar en body para backdrop/z-index
    document.body.appendChild(this._element);

    // ✅ NUEVO: modal "APK lista" (se crea aparte, NO toca el resto)
    this._readyEl = document.createElement("div");
    this._readyEl.classList.add("modal", "fade");
    this._readyEl.setAttribute("tabindex", "-1");
    this._readyEl.id = this._ids.readyModal;

    this._readyEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content king-modal king-ready">
          <div class="modal-header border-0">
            <div class="d-flex align-items-center gap-2">
              <div class="king-badge">
                <i class="bi bi-check2-circle"></i>
              </div>
              <div class="d-flex flex-column">
                <h5 class="modal-title king-title m-0" id="${this._ids.readyTitle}">APK lista</h5>
                <small class="king-sub">Ya podés instalarla y usarla</small>
              </div>
            </div>

            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>

          <div class="modal-body">
            <div class="king-ready-card">
              <div class="king-ready-logo">
                <img id="${this._ids.readyLogo}" alt="Logo app">
              </div>

              <div class="king-ready-name" id="${this._ids.readyName}">KINGVPN</div>
              <div class="king-ready-pkg" id="${this._ids.readyPkg}">com.kingvpn.app</div>

              <div class="king-ready-msg">
                ✅ Tu APK ya está lista para ser usada.
              </div>
            </div>
          </div>

          <div class="modal-footer border-0 d-flex justify-content-between">
            <button type="button" class="btn king-btn-cancel" id="${this._ids.readyBtnClose}" data-bs-dismiss="modal">
              <i class="bi bi-x-lg"></i> Cerrar
            </button>

            <button type="button" class="btn king-btn-download" id="${this._ids.readyBtnDownload}">
              <i class="bi bi-download"></i> Descargar
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this._readyEl);

    // ✅ estilos SOLO para este modal
    this._injectScopedStyles();

    // Bootstrap modal instance
    this.modal = new bootstrap.Modal(this._element);
    this.readyModal = new bootstrap.Modal(this._readyEl);

    // Estado interno
    this._apkUrl = null;
    this._logoBase64 = null;
    this._logoFilename = null;

    // ✅ build cancel (por si lo implementás en backend)
    this._buildId = null;
    this._overlayTimer = null;

    this._bind();
  }

  _injectScopedStyles() {
    const styleId = `apk_modal_styles_${this._uid}`;
    if (document.getElementById(styleId)) return;

    const s = document.createElement("style");
    s.id = styleId;

    const scope = `#${CSS.escape(this._ids.modal)}`;
    const scopeReady = `#${CSS.escape(this._ids.readyModal)}`;

    s.textContent = `
      ${scope} .king-modal{
        background: rgba(6,6,16,.94) !important;
        color: #eef3ff !important;
        border-radius: 24px !important;
        border: 1px solid rgba(255,211,77,.22) !important;
        box-shadow: 0 45px 140px rgba(0,0,0,.78) !important;
        overflow: hidden;
        backdrop-filter: blur(12px);
        position: relative;
      }

      ${scope} .modal-header,
      ${scope} .modal-footer{
        background:
          radial-gradient(900px 420px at 8% 0%, rgba(255,211,77,.18), transparent 60%),
          radial-gradient(900px 420px at 92% 10%, rgba(34,211,238,.14), transparent 60%),
          linear-gradient(180deg, rgba(6,6,16,.92), rgba(6,6,16,.88)) !important;
        border-color: rgba(255,211,77,.12) !important;
      }

      ${scope} .king-badge{
        width: 40px;
        height: 40px;
        border-radius: 14px;
        display:flex;
        align-items:center;
        justify-content:center;
        background:
          radial-gradient(18px 18px at 30% 30%, rgba(255,211,77,.35), transparent 60%),
          radial-gradient(18px 18px at 70% 60%, rgba(34,211,238,.25), transparent 60%),
          rgba(10,10,24,.65);
        border: 1px solid rgba(255,211,77,.20);
        box-shadow: 0 0 0 1px rgba(255,211,77,.08), 0 14px 30px rgba(0,0,0,.45);
      }
      ${scope} .king-badge i{ color:#ffd34d; font-size: 1.1rem; }

      ${scope} .king-title{
        font-weight: 950;
        letter-spacing: .14em;
        text-transform: uppercase;
        font-size: .95rem !important;
      }
      ${scope} .king-sub{
        color: rgba(238,243,255,.70);
        letter-spacing: .06em;
      }

      ${scope} .form-control{
        background: rgba(10,10,24,.65) !important;
        color: rgba(238,243,255,.95) !important;
        border: 1px solid rgba(255,211,77,.16) !important;
        border-radius: 14px !important;
      }
      ${scope} .form-control:focus{
        box-shadow: 0 0 0 3px rgba(255,211,77,.18) !important;
        border-color: rgba(255,183,3,.35) !important;
      }

      ${scope} .app-grid{
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      @media (max-width: 520px){
        ${scope} .app-grid{ grid-template-columns: 1fr; }
      }

      ${scope} .logo-preview{
        display:flex;
        align-items:center;
        gap: 10px;
        padding: 10px;
        border-radius: 16px;
        border: 1px dashed rgba(255,211,77,.22);
        background: rgba(10,10,24,.45);
      }

      /* ✅ Logo SIEMPRE ajustado, nunca enorme */
      ${scope} .logo-bubble{
        width: 56px;
        height: 56px;
        flex: 0 0 56px;
        border-radius: 18px;
        border: 1px solid rgba(255,211,77,.18);
        box-shadow: 0 0 0 1px rgba(34,211,238,.10), 0 14px 28px rgba(0,0,0,.45);
        background: rgba(7,10,18,.85);
        display:flex;
        align-items:center;
        justify-content:center;
        overflow:hidden;
      }
      ${scope} .logo-bubble img{
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        display:none;
      }
      ${scope} .logo-bubble i{
        color: rgba(255,211,77,.95);
        font-size: 1.1rem;
      }

      ${scope} .logo-meta .t1{
        font-weight: 950;
        letter-spacing: .06em;
        font-size: .82rem;
        text-transform: uppercase;
      }
      ${scope} .logo-meta .t2{
        font-size: .85rem;
        color: rgba(238,243,255,.72);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 240px;
      }

      ${scope} .king-status{
        margin: 8px 0 0;
        color: rgba(238,243,255,.72);
      }

      /* ✅ Botones PRO */
      ${scope} .king-btn-cancel{
        background: rgba(255,211,77,.10) !important;
        border: 1px solid rgba(255,211,77,.18) !important;
        border-radius: 999px !important;
        color: rgba(238,243,255,.92) !important;
        font-weight: 950 !important;
        letter-spacing: .10em;
        padding: .60rem 1.1rem;
        transition: transform .15s ease, filter .15s ease, box-shadow .15s ease;
      }
      ${scope} .king-btn-cancel:hover{
        filter: brightness(1.06);
        transform: translateY(-1px);
        box-shadow: 0 10px 24px rgba(0,0,0,.35);
      }

      ${scope} .king-btn-generate{
        background:
          radial-gradient(120px 70px at 20% 30%, rgba(255,211,77,.22), transparent 62%),
          radial-gradient(140px 70px at 75% 30%, rgba(34,211,238,.18), transparent 65%),
          linear-gradient(135deg, rgba(7,10,18,.82), rgba(11,16,32,.94)) !important;
        border: 1px solid rgba(255,211,77,.24) !important;
        border-radius: 999px !important;
        color: rgba(238,243,255,.96) !important;
        font-weight: 950 !important;
        letter-spacing: .12em;
        padding: .60rem 1.2rem;
        box-shadow: 0 0 0 1px rgba(255,211,77,.10), 0 14px 30px rgba(0,0,0,.55) !important;
        transition: transform .15s ease, filter .15s ease, box-shadow .15s ease;
      }
      ${scope} .king-btn-generate:hover{
        transform: translateY(-1px);
        filter: brightness(1.05);
        box-shadow: 0 0 0 1px rgba(34,211,238,.14), 0 18px 40px rgba(0,0,0,.65) !important;
      }
      ${scope} .king-btn-generate:disabled{
        opacity: .65;
        transform:none;
        box-shadow:none !important;
        cursor:not-allowed;
      }

      ${scope} .king-btn-download{
        background: linear-gradient(90deg, rgba(255,211,77,.98), rgba(34,211,238,.92)) !important;
        border: none !important;
        border-radius: 999px !important;
        color: #06101f !important;
        font-weight: 999 !important;
        letter-spacing: .12em;
        padding: .60rem 1.2rem;
        box-shadow: 0 14px 34px rgba(0,0,0,.45);
        transition: transform .15s ease, filter .15s ease, box-shadow .15s ease;
        position: relative;
        overflow:hidden;
      }
      ${scope} .king-btn-download::after{
        content:"";
        position:absolute;
        top:-60%;
        left:-30%;
        width: 60%;
        height: 220%;
        transform: rotate(20deg);
        background: rgba(255,255,255,.22);
        filter: blur(2px);
        opacity:.0;
      }
      ${scope} .king-btn-download:hover{
        transform: translateY(-1px);
        filter: brightness(1.05);
        box-shadow: 0 18px 44px rgba(0,0,0,.55);
      }
      ${scope} .king-btn-download:hover::after{
        opacity: .75;
        animation: kingShine 1.1s ease forwards;
      }
      @keyframes kingShine{
        from{ transform: translateX(0) rotate(20deg); }
        to{ transform: translateX(260%) rotate(20deg); }
      }

      /* ✅ Overlay pro */
      ${scope} .king-overlay{
        position:absolute;
        inset:0;
        display:none;
        align-items:center;
        justify-content:center;
        background: rgba(2,2,10,.62);
        backdrop-filter: blur(8px);
        z-index: 10;
        padding: 18px;
      }
      ${scope} .king-overlay.show{ display:flex; }

      ${scope} .king-overlay-card{
        width: 100%;
        max-width: 420px;
        border-radius: 22px;
        border: 1px solid rgba(255,211,77,.18);
        background:
          radial-gradient(600px 260px at 20% 0%, rgba(255,211,77,.16), transparent 60%),
          radial-gradient(600px 260px at 90% 20%, rgba(34,211,238,.14), transparent 60%),
          rgba(6,6,16,.92);
        box-shadow: 0 40px 130px rgba(0,0,0,.78);
        padding: 16px 16px 14px;
        text-align:center;
      }

      ${scope} .king-overlay-title{
        font-weight: 999;
        letter-spacing: .10em;
        text-transform: uppercase;
        margin-top: 2px;
      }
      ${scope} .king-overlay-sub{
        color: rgba(238,243,255,.72);
        margin-top: 6px;
      }

      ${scope} .king-progress{
        width:100%;
        height: 10px;
        background: rgba(255,255,255,.08);
        border-radius: 999px;
        overflow:hidden;
        border: 1px solid rgba(255,211,77,.14);
      }
      ${scope} .king-progress-bar{
        width: 0%;
        height: 100%;
        background: linear-gradient(90deg, rgba(255,211,77,.98), rgba(34,211,238,.92));
        border-radius: 999px;
        transition: width .25s ease;
      }

      /* ✅ Orbit loader */
      ${scope} .king-orbit{
        position: relative;
        width: 62px;
        height: 62px;
        margin: 0 auto;
        border-radius: 50%;
        border: 1px solid rgba(255,211,77,.18);
        background: rgba(10,10,24,.35);
        box-shadow: 0 0 0 1px rgba(34,211,238,.08), 0 18px 40px rgba(0,0,0,.45);
        overflow:hidden;
      }
      ${scope} .king-orbit span{
        position:absolute;
        inset: 6px;
        border-radius: 50%;
        border: 2px solid transparent;
        border-top-color: rgba(255,211,77,.95);
        border-right-color: rgba(34,211,238,.85);
        animation: kingSpin 1.0s linear infinite;
      }
      ${scope} .king-orbit span:nth-child(2){
        inset: 13px;
        border-top-color: rgba(34,211,238,.95);
        border-right-color: rgba(255,211,77,.85);
        animation-duration: 1.35s;
      }
      ${scope} .king-orbit span:nth-child(3){
        inset: 20px;
        border-top-color: rgba(255,211,77,.85);
        border-right-color: rgba(34,211,238,.75);
        animation-duration: 1.75s;
      }
      @keyframes kingSpin{ to{ transform: rotate(360deg); } }

      ${scope} .king-btn-cancel-build{
        border-radius: 999px !important;
        padding: .62rem 1rem;
        font-weight: 950 !important;
        letter-spacing: .10em;
        background: rgba(255,90,90,.12) !important;
        border: 1px solid rgba(255,90,90,.22) !important;
        color: rgba(238,243,255,.95) !important;
        transition: transform .15s ease, filter .15s ease;
      }
      ${scope} .king-btn-cancel-build:hover{
        transform: translateY(-1px);
        filter: brightness(1.06);
      }

      ${scope} .king-tip{
        color: rgba(238,243,255,.68);
        font-size: .86rem;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:8px;
      }
      ${scope} .king-tip i{ color: rgba(255,211,77,.95); }

      /* ✅ Spinner original oculto (lo dejamos por compat, pero no se ve) */
      ${scope} #${CSS.escape(this._ids.spinner)}{
        display:none !important;
      }

      ${scope} .app-ready{
        color: rgba(34,211,238,.96) !important;
        text-shadow: 0 0 10px rgba(34,211,238,.25);
        font-weight: 950;
      }
      ${scope} .status-error{
        color: #ff4d4d !important;
        font-weight: 950;
      }

      /* ==============================
         ✅ NUEVO: Estilos del modal listo
         (NO toca nada más, solo el readyModal)
         ============================== */
      ${scopeReady} .king-modal{
        background: rgba(6,6,16,.94) !important;
        color: #eef3ff !important;
        border-radius: 24px !important;
        border: 1px solid rgba(255,211,77,.22) !important;
        box-shadow: 0 45px 140px rgba(0,0,0,.78) !important;
        overflow: hidden;
        backdrop-filter: blur(12px);
      }
      ${scopeReady} .modal-header,
      ${scopeReady} .modal-footer{
        background:
          radial-gradient(900px 420px at 8% 0%, rgba(255,211,77,.18), transparent 60%),
          radial-gradient(900px 420px at 92% 10%, rgba(34,211,238,.14), transparent 60%),
          linear-gradient(180deg, rgba(6,6,16,.92), rgba(6,6,16,.88)) !important;
        border-color: rgba(255,211,77,.12) !important;
      }
      ${scopeReady} .king-ready-card{
        background: rgba(10,10,24,.45);
        border: 1px solid rgba(255,211,77,.14);
        border-radius: 18px;
        padding: 14px 12px;
        box-shadow: 0 18px 50px rgba(0,0,0,.45);
        text-align:center;
      }
      ${scopeReady} .king-ready-logo{
        width: 78px;
        height: 78px;
        margin: 0 auto 10px;
        border-radius: 22px;
        border: 1px solid rgba(255,211,77,.18);
        box-shadow: 0 0 0 1px rgba(34,211,238,.10), 0 16px 30px rgba(0,0,0,.55);
        overflow:hidden;
        background: rgba(7,10,18,.85);
        display:flex;
        align-items:center;
        justify-content:center;
      }
      ${scopeReady} .king-ready-logo img{
        width:100%;
        height:100%;
        object-fit: cover;
        object-position:center;
      }
      ${scopeReady} .king-ready-name{
        font-weight: 999;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
      ${scopeReady} .king-ready-pkg{
        margin-top: 4px;
        font-size: .86rem;
        color: rgba(238,243,255,.70);
        word-break: break-word;
      }
      ${scopeReady} .king-ready-msg{
        margin-top: 10px;
        color: rgba(34,211,238,.92);
        font-weight: 900;
        text-shadow: 0 0 10px rgba(34,211,238,.18);
      }

      ${scopeReady} .king-btn-cancel{
        background: rgba(255,211,77,.10) !important;
        border: 1px solid rgba(255,211,77,.18) !important;
        border-radius: 999px !important;
        color: rgba(238,243,255,.92) !important;
        font-weight: 950 !important;
        letter-spacing: .10em;
        padding: .60rem 1.1rem;
      }
      ${scopeReady} .king-btn-download{
        background: linear-gradient(90deg, rgba(255,211,77,.98), rgba(34,211,238,.92)) !important;
        border: none !important;
        border-radius: 999px !important;
        color: #06101f !important;
        font-weight: 999 !important;
        letter-spacing: .12em;
        padding: .60rem 1.2rem;
        box-shadow: 0 14px 34px rgba(0,0,0,.45);
      }
    `;
    document.head.appendChild(s);
  }

  _q(id) {
    return this._element.querySelector(`#${CSS.escape(id)}`);
  }

  _overlay(show) {
    const ov = this._q(this._ids.overlay);
    if (!ov) return;
    if (show) ov.classList.add("show");
    else ov.classList.remove("show");
  }

  _setProgress(pct, text) {
    const bar = this._q(this._ids.progressBar);
    const txt = this._q(this._ids.progressText);
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    if (txt && text) txt.textContent = text;
  }

  _startFakeProgress() {
    // Progreso “realista” (sin backend streaming) — sube hasta 92% y queda esperando respuesta.
    this._stopFakeProgress();
    let pct = 6;
    const steps = [
      [12, "Preparando recursos"],
      [25, "Copiando base.apk"],
      [42, "Aplicando nombre y paquete"],
      [60, "Insertando credenciales"],
      [75, "Aplicando icono"],
      [88, "Recompilando APK"],
      [92, "Firmando y finalizando…"],
    ];
    let i = 0;

    this._setProgress(pct, steps[0][1]);
    this._overlay(true);

    this._overlayTimer = setInterval(() => {
      if (i >= steps.length) return;
      const [target, label] = steps[i];
      if (pct < target) {
        pct += Math.max(1, Math.round((target - pct) / 6));
        if (pct > target) pct = target;
        this._setProgress(pct, label);
      } else {
        i++;
        if (i < steps.length) this._setProgress(pct, steps[i][1]);
      }
    }, 260);
  }

  _stopFakeProgress() {
    if (this._overlayTimer) {
      clearInterval(this._overlayTimer);
      this._overlayTimer = null;
    }
  }

  _resetUI() {
    const status = this._q(this._ids.status);
    const btnGenerate = this._q(this._ids.btnGenerate);
    const btnDownload = this._q(this._ids.btnDownload);

    const logoImg = this._q(this._ids.logoImg);
    const logoHint = this._q(this._ids.logoHint);
    const logoBubble = this._element.querySelector(`#logoBubble_${CSS.escape(this._uid)}`);
    const logoIcon = logoBubble?.querySelector("i");

    this._apkUrl = null;
    this._logoBase64 = null;
    this._logoFilename = null;
    this._buildId = null;

    this._stopFakeProgress();
    this._overlay(false);
    this._setProgress(0, "Preparando recursos");

    btnDownload.style.display = "none";
    btnGenerate.disabled = false;

    status.classList.remove("app-ready", "status-error");
    status.textContent = "Completá los campos y presioná Generar APK.";

    // preview reset
    if (logoImg) logoImg.style.display = "none";
    if (logoIcon) logoIcon.style.display = "inline-block";
    if (logoHint) logoHint.textContent = "Elegí un PNG o poné una URL";

    // limpiar file input si quedó
    const logoFile = this._q(this._ids.logoFile);
    if (logoFile) logoFile.value = "";

    // ✅ listo modal: reset visual básico
    const rLogo = this._readyEl.querySelector(`#${CSS.escape(this._ids.readyLogo)}`);
    if (rLogo) rLogo.src = "";
    const rName = this._readyEl.querySelector(`#${CSS.escape(this._ids.readyName)}`);
    if (rName) rName.textContent = "KINGVPN";
    const rPkg = this._readyEl.querySelector(`#${CSS.escape(this._ids.readyPkg)}`);
    if (rPkg) rPkg.textContent = "";
  }

  async _readResponseUrl(response) {
    const ct = (response.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      const data = await response.json();
      return data.url || data.apkUrl || data.path || null;
    }
    return (await response.text()).trim();
  }

  _getCreds() {
    // ✅ tu endpoint exige user_id + token
    const creds = window.__APK_CREDS__ || {};
    return {
      user_id: (creds.user_id || "").toString().trim(),
      token: (creds.token || "").toString().trim(),
    };
  }

  // ✅ NUEVO: abrir modal "APK lista" con logo + nombre + botones
  _showReadyModal({ appName, packageName, logoSrc }) {
    const rLogo = this._readyEl.querySelector(`#${CSS.escape(this._ids.readyLogo)}`);
    const rName = this._readyEl.querySelector(`#${CSS.escape(this._ids.readyName)}`);
    const rPkg = this._readyEl.querySelector(`#${CSS.escape(this._ids.readyPkg)}`);
    const rBtnDl = this._readyEl.querySelector(`#${CSS.escape(this._ids.readyBtnDownload)}`);

    if (rName) rName.textContent = appName || "KINGVPN";
    if (rPkg) rPkg.textContent = packageName || "";
    if (rLogo) {
      rLogo.src = logoSrc || "";
      rLogo.onerror = () => {
        // fallback: si falla la url, usa el preview base64 si existe
        if (this._logoBase64) rLogo.src = this._logoBase64;
      };
    }

    if (rBtnDl) {
      rBtnDl.onclick = () => {
        if (this._apkUrl) window.location.href = this._apkUrl;
        this.readyModal.hide();
      };
    }

    this.readyModal.show();
  }

  _bind() {
    const logoUrlEl = this._q(this._ids.logoUrl);
    const logoFileEl = this._q(this._ids.logoFile);
    const logoImg = this._q(this._ids.logoImg);
    const logoHint = this._q(this._ids.logoHint);
    const logoBubble = this._element.querySelector(`#logoBubble_${CSS.escape(this._uid)}`);
    const logoIcon = logoBubble?.querySelector("i");

    const btnGenerate = this._q(this._ids.btnGenerate);
    const btnDownload = this._q(this._ids.btnDownload);
    const status = this._q(this._ids.status);

    const btnCancelBuild = this._q(this._ids.btnCancelBuild);

    // ✅ Al abrir, resetea siempre
    this._element.addEventListener("show.bs.modal", () => this._resetUI());

    // ✅ URL logo (solo preview)
    logoUrlEl.addEventListener("input", () => {
      const url = (logoUrlEl.value || "").trim();
      if (!url) return;

      if (!this._logoBase64) {
        logoImg.src = url;
        logoImg.style.display = "block";
        if (logoIcon) logoIcon.style.display = "none";
        logoHint.textContent = url;
      }
    });

    // ✅ PNG base64
    logoFileEl.addEventListener("change", () => {
      const file = logoFileEl.files && logoFileEl.files[0];
      if (!file) return;

      if (file.type !== "image/png") {
        if (typeof showToastError === "function") showToastError("El logo debe ser PNG.");
        logoFileEl.value = "";
        return;
      }

      this._logoFilename = file.name;

      const reader = new FileReader();
      reader.onload = () => {
        this._logoBase64 = reader.result;
        logoImg.src = this._logoBase64;

        logoImg.style.display = "block";
        if (logoIcon) logoIcon.style.display = "none";
        logoHint.textContent = file.name;
      };
      reader.readAsDataURL(file);
    });

    // ✅ Cancelar generación (frontend)
    btnCancelBuild.addEventListener("click", async () => {
      // UX: cierra overlay y re-habilita botones
      this._stopFakeProgress();
      this._overlay(false);

      btnGenerate.disabled = false;
      status.classList.remove("app-ready");
      status.classList.add("status-error");
      status.textContent = "Generación cancelada.";

      // Si implementás cancel en backend, descomentá:
      /*
      try{
        if (this._buildId){
          let csrfToken = (typeof getCsrfTokenHead === "function") ? getCsrfTokenHead() : null;
          await fetch('/download-app', {
            method:'POST',
            headers:{
              'Content-Type':'application/json',
              ...(csrfToken ? {'csrf-token': csrfToken} : {})
            },
            body: JSON.stringify({ cancel:true, build_id:this._buildId })
          });
        }
      }catch{}
      */
    });

    // ✅ GENERAR APP
    btnGenerate.addEventListener("click", async () => {
      const appName = (this._q(this._ids.appName).value || "").trim() || "KINGVPN";
      const packageName = (this._q(this._ids.packageName).value || "").trim() || null;
      const logo_url = (logoUrlEl.value || "").trim() || null;

      let csrfToken = (typeof getCsrfTokenHead === "function") ? getCsrfTokenHead() : null;

      const { user_id, token } = this._getCreds();
      if (!user_id || !token) {
        status.classList.add("status-error");
        status.textContent = "Faltan credenciales (user_id/token).";
        if (typeof showToastError === "function") showToastError("Faltan credenciales (user_id/token).");
        return;
      }

      // ✅ build_id para futuras cancelaciones
      this._buildId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

      const payload = {
        user_id,
        token,
        build_id: this._buildId,
        appName,
        packageName,
        logo_url,
        logo_base64: this._logoBase64 || null,
        logo_filename: this._logoFilename || null,
      };

      btnGenerate.disabled = true;
      btnDownload.style.display = "none";
      status.classList.remove("app-ready", "status-error");
      status.textContent = "Generando tu aplicación…";

      // ✅ overlay + progreso pro
      this._startFakeProgress();

      try {
        const response = await fetch("/download-app", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "csrf-token": csrfToken } : {}),
          },
          body: JSON.stringify(payload),
        });

        if (typeof getCsrfTokenRefresh === "function") {
          const refreshed = getCsrfTokenRefresh(response);
          if (refreshed) csrfToken = refreshed;
        }

        if (!response.ok) throw new Error("Backend respondió error");

        const url = await this._readResponseUrl(response);
        if (!url) throw new Error("No vino URL");

        this._apkUrl = url;

        // ✅ fin pro
        this._stopFakeProgress();
        this._setProgress(100, "Listo ✅");
        setTimeout(() => this._overlay(false), 450);

        status.textContent = "¡Tu APK está listo!";
        status.classList.add("app-ready");

        // ✅ MANTENER tu botón original (no lo toco)
        btnDownload.style.display = "inline-block";
        btnDownload.onclick = () => {
          window.location.href = this._apkUrl;
          this.hide();
        };

        // ✅ NUEVO: mostrar modal listo con X, cerrar y descargar + logo + nombre
        // prioridad de logo:
        // 1) base64 (si subió PNG)
        // 2) url (si escribió url)
        // 3) el preview actual del img (por si)
        const logoSrc =
          this._logoBase64 ||
          logo_url ||
          (logoImg && logoImg.src ? logoImg.src : "");

        // cerramos el modal generador y abrimos el "APK lista"
        this.hide();
        this._showReadyModal({
          appName,
          packageName: packageName || "",
          logoSrc,
        });
      } catch (e) {
        this._stopFakeProgress();
        this._overlay(false);

        btnGenerate.disabled = false;
        status.textContent = "Error al generar la app. Intentá nuevamente.";
        status.classList.add("status-error");
      }
    });
  }

  show() {
    this.modal.show();
  }

  hide() {
    this.modal.hide();
  }
}

export default ApkDownloadModal;
