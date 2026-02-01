class CdnModal {
    constructor(form) {
        this.form = form;
        this.element = document.createElement('div');
        this.element.classList.add('modal-dialog', 'modal-dialog-centered');
        this.element.setAttribute('role', 'document');

        this.element.innerHTML = `
            <div class="modal-content cdn-premium">
                <div class="modal-header cdn-premium__header">
                    <h5 class="modal-title cdn-premium__title">
                        <i class="bi bi-cloud-fill me-2"></i> CDN
                    </h5>
                    <button type="button" class="btn-close cdn-premium__close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                </div>

                <div class="modal-body cdn-premium__body"></div>

                <div class="modal-footer d-flex justify-content-between flex-nowrap cdn-premium__footer">
                    <button type="button" class="btn btn-outline-light w-100 me-2 cdn-premium__btn" data-bs-dismiss="modal">
                        Cancelar
                    </button>
                    <button type="button" class="btn w-100 cdn-premium__btn cdn-premium__btn--gold">
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

        // ✅ Inyecta estilos premium SOLO para este modal (sin romper el resto)
        if (!document.getElementById('cdnPremiumModalStyles')) {
            const style = document.createElement('style');
            style.id = 'cdnPremiumModalStyles';
            style.textContent = `
                :root{
                    --gold-main:#D4AF37;
                    --gold-soft:#FFD36A;
                    --gold-hi:#FFE7A6;
                    --gold-deep:#8C6400;

                    --bg1:#07070B;
                    --bg2:#0E0F16;

                    --panel1:rgba(18,20,32,.96);
                    --panel2:rgba(12,13,18,.96);

                    --text:#F2F3F7;
                    --muted:rgba(242,243,247,.72);
                    --line:rgba(255,215,120,.18);

                    --shadow:0 18px 55px rgba(0,0,0,.72);
                    --radius:18px;
                }

                /* Backdrop un toque más pro */
                .modal-backdrop.show{ opacity:.72; }

                /* Contenedor */
                .cdn-premium{
                    border-radius: var(--radius);
                    background:
                        radial-gradient(520px 160px at 18% 0%, rgba(255,211,106,.12), transparent 60%),
                        linear-gradient(180deg, var(--panel1), var(--panel2));
                    border: 1px solid var(--line);
                    box-shadow: var(--shadow);
                    overflow:hidden;
                    position:relative;
                }

                .cdn-premium::before{
                    content:"";
                    position:absolute;
                    inset:-40%;
                    background:linear-gradient(120deg, transparent 45%, rgba(255,255,255,.12) 50%, transparent 55%);
                    filter:blur(18px);
                    opacity:.22;
                    transform:translateX(-140%);
                    animation:cdnSheen 8s linear infinite;
                    pointer-events:none;
                }
                @keyframes cdnSheen{ from{transform:translateX(-140%)} to{transform:translateX(140%)} }

                /* Header */
                .cdn-premium__header{
                    border-bottom: 1px solid rgba(255,215,120,.12);
                    background:
                        radial-gradient(520px 120px at 18% 30%, rgba(255,231,166,.10), transparent 65%),
                        rgba(0,0,0,.18);
                }
                .cdn-premium__title{
                    margin:0;
                    font-weight:950;
                    letter-spacing:.14em;
                    text-transform:uppercase;
                    color: var(--gold-soft);
                    text-shadow: 0 2px 0 rgba(60,35,0,.55), 0 8px 18px rgba(0,0,0,.55);
                    display:flex;
                    align-items:center;
                }
                .cdn-premium__close{
                    filter: invert(1) opacity(.85);
                }

                /* Body */
                .cdn-premium__body{
                    padding: 14px;
                    color: var(--text);
                }

                /* Inputs premium */
                .cdn-premium .form-label{
                    color: rgba(255,242,194,.88);
                    font-weight: 800;
                    letter-spacing: .06em;
                    text-transform: uppercase;
                    font-size: .74rem;
                    margin-bottom: .35rem;
                }

                .cdn-premium .form-control,
                .cdn-premium .form-select{
                    background: rgba(8,8,12,.58);
                    color: var(--text);
                    border: 1px solid rgba(255,215,120,.20);
                    border-radius: 14px;
                    padding: .75rem .85rem;
                    box-shadow: inset 0 0 0 1px rgba(255,255,255,.04);
                }

                .cdn-premium .form-control::placeholder{
                    color: rgba(242,243,247,.55);
                }

                .cdn-premium .form-control:focus,
                .cdn-premium .form-select:focus{
                    border-color: rgba(255,211,106,.75);
                    box-shadow: 0 0 0 3px rgba(255,211,106,.18);
                    outline: none;
                }

                /* Footer y botones */
                .cdn-premium__footer{
                    border-top: 1px solid rgba(255,215,120,.12);
                    padding: 12px 14px;
                    background: rgba(0,0,0,.16);
                }

                .cdn-premium__btn{
                    border-radius: 14px;
                    font-weight: 900;
                    letter-spacing: .08em;
                    text-transform: uppercase;
                    padding: 10px 12px;
                }

                .cdn-premium__btn--gold{
                    border: none;
                    color: #2b1a00;
                    background: linear-gradient(145deg, var(--gold-soft), var(--gold-main));
                    box-shadow: 0 12px 30px rgba(0,0,0,.55);
                }
                .cdn-premium__btn--gold:hover{ filter: brightness(1.05); transform: translateY(-1px); }

                .cdn-premium .btn-outline-light{
                    border-color: rgba(255,215,120,.22) !important;
                    color: rgba(255,231,166,.95) !important;
                    background: rgba(0,0,0,.22) !important;
                }
                .cdn-premium .btn-outline-light:hover{
                    background: rgba(255,211,106,.10) !important;
                }
            `;
            document.head.appendChild(style);
        }

        this.element.querySelector('.modal-body').appendChild(this.form.render());
        this._root.appendChild(this.element);

        document.body.appendChild(this._root);
        this.modal = new bootstrap.Modal(this._root);
        this.modal.show();

        // Limpieza cuando se cierra (no rompe nada)
        this._root.addEventListener('hidden.bs.modal', () => {
            try { this._root.remove(); } catch {}
        }, { once: true });
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
                <input type="text" class="__name form-control" required placeholder="Ej: Mi CDN">
            </div>
            <div class="col-md-12">
                <label class="form-label">URL</label>
                <input type="text" class="__url form-control" required placeholder="https://...">
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
        this.name.addEventListener('input', e => {
            this.cdn.name = e.target.value;
        });

        this.url.addEventListener('input', e => {
            this.cdn.url = e.target.value;
        });

        this.status.addEventListener('input', e => {
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
