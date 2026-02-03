class CdnModal {
  constructor(form) {
    this.form = form;
    this.element = document.createElement('div');
    this.element.classList.add('modal-dialog', 'modal-dialog-centered');
    this.element.setAttribute('role', 'document');

    this.element.innerHTML = `
      <div class="modal-content cdn-premium">
        <div class="cdn-premium__fx" aria-hidden="true"></div>

        <div class="modal-header cdn-premium__header">
          <h5 class="modal-title cdn-premium__title">
            <span class="cdn-premium__badge">
              <i class="bi bi-cloud-fill"></i>
            </span>
            <span class="cdn-premium__titleText">CDN</span>
          </h5>

          <button type="button" class="btn-close cdn-premium__close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
        </div>

        <div class="modal-body cdn-premium__body"></div>

        <div class="modal-footer d-flex justify-content-between flex-nowrap cdn-premium__footer">
          <button type="button" class="btn w-100 me-2 cdn-premium__btn cdn-premium__btn--ghost" data-bs-dismiss="modal">
            Cancelar
          </button>
          <button type="button" class="btn w-100 cdn-premium__btn cdn-premium__btn--gold">
            <span class="cdn-premium__btnGlow" aria-hidden="true"></span>
            Guardar
          </button>
        </div>
      </div>
    `;
  }

  setOnSave(fn) {
    const button = this.element.querySelector('.modal-footer button:last-child');
    button.addEventListener('click', fn);
  }

  show() {
    this._root = document.createElement('div');
    this._root.classList.add('modal', 'fade');
    this._root.setAttribute('tabindex', '-1');

    // ✅ Estilos premium SOLO este modal (no rompe el resto)
    if (!document.getElementById('cdnPremiumModalStyles')) {
      const style = document.createElement('style');
      style.id = 'cdnPremiumModalStyles';
      style.textContent = `
        :root{
          --gold-1:#FFE7A6;
          --gold-2:#FFD36A;
          --gold-3:#D4AF37;
          --gold-4:#8C6400;

          --bg-0:#05060A;
          --bg-1:#080A10;
          --bg-2:#0B0E16;

          --text:#F2F3F7;
          --muted:rgba(242,243,247,.72);

          --line:rgba(255,215,120,.20);
          --line2:rgba(255,215,120,.10);

          --shadow:0 24px 90px rgba(0,0,0,.78);
          --radius:22px;
        }

        /* Backdrop más pro */
        .modal-backdrop.show{ opacity:.78; }

        /* ===== Modal Container ===== */
        .cdn-premium{
          border-radius: var(--radius);
          position:relative;
          overflow:hidden;

          background:
            radial-gradient(900px 260px at 14% 0%, rgba(255,231,166,.16), transparent 62%),
            radial-gradient(700px 240px at 90% 8%, rgba(212,175,55,.12), transparent 62%),
            linear-gradient(180deg, rgba(18,20,32,.97), rgba(6,7,10,.97));

          box-shadow: var(--shadow);

          /* borde doble premium */
          border:1px solid var(--line);
        }

        .cdn-premium::after{
          content:"";
          position:absolute;
          inset:0;
          pointer-events:none;
          border-radius: var(--radius);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,.03),
            inset 0 0 0 2px rgba(212,175,55,.08),
            0 0 0 1px rgba(0,0,0,.65);
        }

        /* FX overlay (shimmer + partículas) */
        .cdn-premium__fx{
          position:absolute;
          inset:-120px;
          pointer-events:none;
          z-index:0;
        }
        .cdn-premium__fx::before{
          content:"";
          position:absolute;
          inset:0;
          background: linear-gradient(120deg, transparent 40%, rgba(255,255,255,.14) 50%, transparent 60%);
          transform: translateX(-140%);
          opacity:.35;
          filter: blur(14px);
          animation: cdnSheen 7.2s linear infinite;
        }
        .cdn-premium__fx::after{
          content:"";
          position:absolute;
          inset:0;
          background:
            radial-gradient(3px 3px at 12% 20%, rgba(255,231,166,.35), transparent 60%),
            radial-gradient(2px 2px at 78% 30%, rgba(255,211,106,.25), transparent 60%),
            radial-gradient(2px 2px at 40% 70%, rgba(212,175,55,.22), transparent 60%),
            radial-gradient(2px 2px at 88% 78%, rgba(255,255,255,.10), transparent 60%),
            radial-gradient(2px 2px at 20% 88%, rgba(255,211,106,.18), transparent 60%);
          opacity:.8;
        }

        @keyframes cdnSheen{
          0%{ transform: translateX(-140%); }
          100%{ transform: translateX(140%); }
        }

        /* ===== Header ===== */
        .cdn-premium__header{
          position:relative;
          z-index:1;
          border-bottom:1px solid rgba(255,215,120,.12);

          background:
            radial-gradient(700px 150px at 18% 40%, rgba(255,231,166,.14), transparent 62%),
            linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.10));
        }

        /* bar dorada superior */
        .cdn-premium__header::before{
          content:"";
          position:absolute;
          left:0; right:0; top:0;
          height:3px;
          background: linear-gradient(90deg, rgba(255,231,166,.0), rgba(255,231,166,.9), rgba(212,175,55,.9), rgba(255,231,166,.0));
          box-shadow: 0 0 18px rgba(255,211,106,.25);
          opacity:.9;
        }

        .cdn-premium__title{
          margin:0;
          display:flex;
          align-items:center;
          gap:10px;
        }

        .cdn-premium__badge{
          width:34px;
          height:34px;
          border-radius:12px;
          display:grid;
          place-items:center;

          background:
            radial-gradient(120px 60px at 30% 20%, rgba(255,255,255,.30), transparent 55%),
            linear-gradient(145deg, var(--gold-2), var(--gold-3));
          box-shadow:
            0 14px 35px rgba(0,0,0,.55),
            inset 0 0 0 1px rgba(255,255,255,.18);
        }
        .cdn-premium__badge i{
          color:#2b1a00;
          font-size:1.05rem;
        }

        .cdn-premium__titleText{
          font-weight:950;
          letter-spacing:.18em;
          text-transform:uppercase;
          color: var(--gold-2);
          text-shadow:
            0 2px 0 rgba(40,20,0,.65),
            0 12px 22px rgba(0,0,0,.55);
        }

        .cdn-premium__close{
          filter: invert(1) opacity(.86);
        }

        /* ===== Body ===== */
        .cdn-premium__body{
          position:relative;
          z-index:1;
          padding: 14px 14px 6px;
          color: var(--text);
        }

        /* ===== Forms premium ===== */
        .cdn-premium .form-label{
          color: rgba(255,242,194,.90);
          font-weight: 900;
          letter-spacing: .10em;
          text-transform: uppercase;
          font-size: .72rem;
          margin-bottom: .35rem;
        }

        .cdn-premium .form-control,
        .cdn-premium .form-select{
          background:
            radial-gradient(420px 140px at 20% 0%, rgba(255,211,106,.08), transparent 60%),
            rgba(6,7,10,.55);
          color: var(--text);
          border: 1px solid rgba(255,215,120,.22);
          border-radius: 16px;
          padding: .82rem .9rem;
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,.05),
            0 10px 26px rgba(0,0,0,.35);
          transition: box-shadow .18s ease, border-color .18s ease, transform .18s ease;
        }

        .cdn-premium .form-control::placeholder{
          color: rgba(242,243,247,.55);
        }

        .cdn-premium .form-control:focus,
        .cdn-premium .form-select:focus{
          border-color: rgba(255,211,106,.85);
          box-shadow:
            0 0 0 3px rgba(255,211,106,.18),
            0 14px 34px rgba(0,0,0,.42),
            inset 0 0 0 1px rgba(255,255,255,.06);
          outline: none;
          transform: translateY(-1px);
        }

        .cdn-premium .form-select{
          cursor:pointer;
        }

        /* ===== Footer ===== */
        .cdn-premium__footer{
          position:relative;
          z-index:1;
          border-top: 1px solid rgba(255,215,120,.12);
          padding: 12px 14px 14px;
          background: rgba(0,0,0,.16);
        }

        .cdn-premium__btn{
          border-radius: 16px;
          font-weight: 950;
          letter-spacing: .12em;
          text-transform: uppercase;
          padding: 11px 12px;
          position:relative;
          overflow:hidden;
          transition: transform .16s ease, filter .16s ease, box-shadow .16s ease;
        }

        /* Cancel (ghost) */
        .cdn-premium__btn--ghost{
          color: rgba(255,231,166,.94) !important;
          background:
            radial-gradient(220px 90px at 20% 20%, rgba(255,211,106,.08), transparent 62%),
            rgba(0,0,0,.25) !important;
          border: 1px solid rgba(255,215,120,.22) !important;
          box-shadow: 0 14px 30px rgba(0,0,0,.45);
        }
        .cdn-premium__btn--ghost:hover{
          background: rgba(255,211,106,.10) !important;
          transform: translateY(-1px);
        }

        /* Guardar (gold bar) */
        .cdn-premium__btn--gold{
          border:none;
          color:#2b1a00;
          background:
            radial-gradient(240px 90px at 20% 20%, rgba(255,255,255,.35), transparent 60%),
            linear-gradient(145deg, var(--gold-1), var(--gold-2), var(--gold-3));
          box-shadow:
            0 18px 40px rgba(0,0,0,.55),
            0 0 0 1px rgba(255,231,166,.20);
        }

        /* brillo interno del botón */
        .cdn-premium__btnGlow{
          position:absolute;
          inset:-60%;
          background: linear-gradient(120deg, transparent 40%, rgba(255,255,255,.35) 50%, transparent 60%);
          transform: translateX(-140%);
          opacity:.55;
          filter: blur(10px);
          animation: btnSheen 5.6s linear infinite;
          pointer-events:none;
        }
        @keyframes btnSheen{
          0%{ transform: translateX(-140%); }
          100%{ transform: translateX(140%); }
        }

        .cdn-premium__btn--gold:hover{
          filter: brightness(1.05);
          transform: translateY(-1px);
        }
        .cdn-premium__btn--gold:active{
          transform: translateY(0px);
          filter: brightness(.98);
        }

        /* Validación bootstrap */
        .cdn-premium .was-validated .form-control:invalid,
        .cdn-premium .was-validated .form-select:invalid{
          border-color: rgba(255,90,90,.55);
          box-shadow: 0 0 0 3px rgba(255,90,90,.12);
        }

        @media (prefers-reduced-motion: reduce){
          .cdn-premium__fx::before,
          .cdn-premium__btnGlow{ animation:none !important; }
        }
      `;
      document.head.appendChild(style);
    }

    this.element.querySelector('.modal-body').appendChild(this.form.render());
    this._root.appendChild(this.element);

    document.body.appendChild(this._root);
    this.modal = new bootstrap.Modal(this._root);
    this.modal.show();

    this._root.addEventListener(
      'hidden.bs.modal',
      () => {
        try { this._root.remove(); } catch {}
      },
      { once: true }
    );
  }

  hide() {
    if (this.modal) this.modal.hide();
  }
}

class CdnForm {
  __html = `
    <div class="mb-3 row">
      <div class="col-md-12 mb-2">
        <label class="form-label">Nombre</label>
        <input type="text" class="__name form-control" required placeholder="Ej: Mi CDN Pro">
      </div>

      <div class="col-md-12">
        <label class="form-label">URL</label>
        <input type="text" class="__url form-control" required placeholder="https://tudominio.com">
      </div>
    </div>

    <div class="mb-3 row">
      <div class="col-md-12">
        <label class="form-label">Estado</label>
        <select class="__status form-select">
          <option value="ACTIVE">ACTIVO</option>
          <option value="INACTIVE">INACTIVO</option>
        </select>
      </div>
    </div>
  `;

  constructor(cdn) {
    this.cdn = cdn;

    this.element = document.createElement('form');
    this.element.classList.add('form-group');
    this.element.innerHTML = this.__html;

    this.name = this.element.querySelector('.__name');
    this.url = this.element.querySelector('.__url');
    this.status = this.element.querySelector('.__status');

    this.setup();
  }

  setup() {
    this.name.addEventListener('input', (e) => {
      this.cdn.name = e.target.value;
    });

    this.url.addEventListener('input', (e) => {
      this.cdn.url = e.target.value;
    });

    this.status.addEventListener('input', (e) => {
      this.cdn.status = e.target.value;
    });
  }

  validate() {
    if (this.element.checkValidity()) return true;
    this.element.classList.add('was-validated');
    return false;
  }

  render() {
    this.name.value = this.cdn.name || '';
    this.url.value = this.cdn.url || '';
    this.status.value = this.cdn.status || 'ACTIVE';
    return this.element;
  }
}

export { CdnModal, CdnForm };
