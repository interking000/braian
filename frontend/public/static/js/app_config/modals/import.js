import AppConfigView from "../components/app.js";
import AppConfig from "../models.js";

class AppConfigImportFile {
    async load(file) {
        const promise = new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve(e.target.result);
            };
            reader.onerror = (e) => {
                reject(e);
            };
            reader.readAsText(file);
        });
        return promise;
    }
}

class AppConfigImportUrl {
    async load(url) {
        const data = await fetch(url);
        return data.text();
    }
}

class AppConfigImportFactory {
    static create(type) {
        if (type === 'URL') {
            return new AppConfigImportUrl();
        }
        if (type === 'FILE') {
            return new AppConfigImportFile();
        }
    }
}

class AppConfigImportModal {
    __html = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content kv-import-modal">
                <div class="modal-header kv-import-header">
                    <h5 class="modal-title kv-import-title">Importar configuraciones</h5>
                    <button type="button" class="btn-close kv-import-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>

                <div class="modal-body kv-import-body">
                    <!-- ✅ NO mostramos el código, pero lo dejamos para que el import funcione -->
                    <textarea class="form-control mb-3 d-none" rows="10"></textarea>

                    <div class="__spinner d-none p-5 kv-spinner">
                        <div class="spinner-border text-dark p-3" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>

                    <!-- ✅ Vista previa más chica -->
                    <div class="__preview d-flex align-items-center justify-content-center kv-preview"></div>

                    <div class="mb-3">
                        <label for="import-url" class="form-label kv-label">URL</label>
                        <input type="text" class="form-control kv-input" id="import-url" placeholder="Pegá la URL acá">
                        <div class="kv-help">Se previsualiza automáticamente al cargar.</div>
                    </div>

                    <div class="mb-3">
                        <label for="import-file" class="form-label kv-label">ARCHIVO</label>
                        <input class="form-control kv-input" type="file" id="import-file" accept=".json,application/json">
                    </div>
                </div>

                <div class="modal-footer d-flex flex-nowrap kv-import-footer">
                    <button type="button" class="btn btn-dark w-100 me-2 kv-btn-close" data-bs-dismiss="modal">Cerrar</button>
                    <button type="button" class="btn btn-dark w-100 btn__import kv-btn-import">Importar</button>
                </div>
            </div>
        </div>

        <style>
            /* =============================
               KING•VPN – Import Modal Premium
               (sin romper lógica original)
               ============================= */

            .kv-import-modal{
                border-radius: 20px;
                overflow: hidden;
                border: 1px solid rgba(255,215,120,.22);
                background:
                    radial-gradient(900px 420px at 18% 10%, rgba(255,211,106,.14), transparent 62%),
                    radial-gradient(900px 420px at 82% 8%, rgba(212,175,55,.12), transparent 62%),
                    linear-gradient(180deg, rgba(14,10,2,.92), rgba(8,6,2,.95));
                box-shadow: 0 25px 70px rgba(30,18,0,.70);
                color: rgba(255,242,194,.95);
            }

            .kv-import-header{
                border-bottom: 1px solid rgba(255,215,120,.14);
                background: linear-gradient(90deg, rgba(255,231,166,.08), rgba(0,0,0,.18));
                padding: 14px 16px;
            }

            .kv-import-title{
                margin: 0;
                font-weight: 1000;
                letter-spacing: .12em;
                text-transform: uppercase;
                color: rgba(255,231,166,.98);
                text-shadow: 0 2px 0 rgba(80,40,0,.55), 0 10px 22px rgba(0,0,0,.45);
            }

            .kv-import-close{
                filter: invert(1);
                opacity: .9;
            }

            .kv-import-body{
                padding: 14px 16px 6px;
            }

            .kv-label{
                font-weight: 900;
                letter-spacing: .10em;
                text-transform: uppercase;
                font-size: .78rem;
                color: rgba(255,231,166,.92);
                margin-left: 2px;
            }

            .kv-input{
                border-radius: 14px;
                border: 1px solid rgba(255,215,120,.22);
                background: rgba(0,0,0,.22);
                color: rgba(255,242,194,.96);
                box-shadow: inset 0 0 0 1px rgba(255,255,255,.04);
            }
            .kv-input::placeholder{ color: rgba(255,242,194,.45); }

            .kv-input:focus{
                background: rgba(0,0,0,.26);
                border-color: rgba(255,231,166,.55);
                box-shadow: 0 0 0 3px rgba(255,215,120,.20);
                color: rgba(255,242,194,.98);
            }

            .kv-help{
                margin-top: 6px;
                font-size: .82rem;
                color: rgba(255,242,194,.62);
            }

            /* Spinner centrado y lindo */
            .kv-spinner{
                min-height: 220px;
            }
            .kv-spinner .spinner-border{
                width: 3rem;
                height: 3rem;
                color: rgba(255,215,120,.95) !important;
            }

            /* ✅ Preview más chica, tipo “mini phone” */
            .kv-preview{
                width: 100%;
                min-height: 140px;
                margin: 8px 0 14px;
            }

            /* El preview que insertás (AppConfigView) lo “encuadramos” y lo hacemos más chico */
            .kv-preview > *{
                border-radius: 18px !important;
                overflow: hidden !important;
                border: 1px solid rgba(255,215,120,.22);
                box-shadow: 0 18px 45px rgba(0,0,0,.45);
                background: rgba(0,0,0,.12);
            }

            .kv-import-footer{
                border-top: 1px solid rgba(255,215,120,.12);
                background: rgba(0,0,0,.12);
                padding: 12px 16px;
            }

            /* Botones conservan btn-dark, solo los “premium-izamos” un toque */
            .kv-btn-close{
                border: 1px solid rgba(255,215,120,.18) !important;
                background: rgba(0,0,0,.20) !important;
            }
            .kv-btn-import{
                border: 1px solid rgba(255,215,120,.22) !important;
                background: linear-gradient(145deg, rgba(255,211,106,.22), rgba(184,138,26,.16)) !important;
            }
        </style>
    `;

    constructor() {
        this.element = document.createElement('div');
        this.element.classList.add('modal', 'fade');
        this.element.setAttribute('tabindex', '-1');
        this.element.innerHTML = this.__html;

        this.element.querySelector('.btn__import').addEventListener('click', this.__onImportClick.bind(this));
        this.element.querySelector('#import-file').addEventListener('change', this.__onFileChange.bind(this));
        this.element.querySelector('#import-url').addEventListener('input', this.__onUrlChange.bind(this));

        this.spinner = this.element.querySelector('.__spinner');

        this.modal = new bootstrap.Modal(this.element);
        this.textarea = this.element.querySelector('textarea');
        this.preview = this.element.querySelector('.__preview');

        this.callbackOnImport = null;
    }

    showPreview(config) {
        try {
            // ✅ Más chico que el original (solo visual)
            const app = new AppConfigView(AppConfig.fromJson({
                id: null,
                app_config: JSON.parse(config)
            }), {
                maxWidth: '230px',
                height: '340px',
                padding: '0 10px',
            });

            this.preview.innerHTML = '';
            this.preview.appendChild(app.element);

            // ✅ EXTRA: lo escalamos un poquito para que quede “mini preview”
            // (no rompe nada; solo visual)
            app.element.style.transform = 'scale(0.92)';
            app.element.style.transformOrigin = 'top center';

        } catch (e) {
            showToastError('Configuracion invalidas!');
        };
    }

    showSpinner() {
        this.spinner.classList.remove('d-none');
        this.spinner.classList.add('d-flex', 'justify-content-center', 'align-items-center');
        this.preview.innerHTML = '';
    }

    hideSpinner() {
        this.spinner.classList.add('d-none');

        // ✅ NO mostramos el textarea NUNCA (seguimos usando d-none)
        // this.textarea.style.display = 'block';
        this.textarea.classList.add('d-none');
    }

    setContent(content) {
        // ✅ guardamos el JSON para el botón Importar, pero no lo mostramos
        this.textarea.value = content;
    }

    setCallbackOnImport(callback) {
        this.callbackOnImport = callback;
    }

    __onImportClick() {
        const text = this.element.querySelector('textarea').value;

        if (!text) {
            showToastError('no se exporto ninguna configuración.');
            return;
        }

        try {
            const config = JSON.parse(text);
            this.callbackOnImport(config);
        } catch (e) {
            showToastError('No fue posible importar configuración');
            return;
        }
    }

    __onFileChange(e) {
        this.showSpinner();
        const file = e.target.files[0];
        const importFile = AppConfigImportFactory.create('FILE');
        importFile.load(file).then(text => {
            this.hideSpinner();
            this.setContent(text);
            this.showPreview(text);
        });
    }

    __onUrlChange(e) {
        this.showSpinner();
        const url = e.target.value;
        const importUrl = AppConfigImportFactory.create('URL');
        importUrl.load(url).then(text => {
            this.hideSpinner();
            this.setContent(text);
            this.showPreview(text);
        });
    }

    show() {
        this.modal.show();
    }

    hide() {
        this.modal.hide();
    }
}

export default AppConfigImportModal;
