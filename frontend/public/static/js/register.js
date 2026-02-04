class ServicioRegistro {
    async registrar(data) {

        const response = await fetch('/register', {
            method: 'POST',
            body: JSON.stringify({
                username: data.username,
                password: data.password,
                email: data.email,
            }),
            headers: {
                'csrf-token': data.csrfToken,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 201) return;

        const csrfTokenRefresh = getCsrfTokenRefresh(response);
        if (csrfTokenRefresh) {
            data.formularioRegistro.actualizarCsrfToken(csrfTokenRefresh)
        }

        const resultado = await response.json();
        if (resultado.message) throw new Error(resultado.message);
    }
}

class FormularioRegistro {
    constructor() {
        this.elemento = document.querySelector('form');
        this.csrfToken = getCsrfTokenHead();
    }

    get formData() {
        return new FormData(this.elemento);
    }

    async obtenerDatos() {
        await this.#validar();
        return {
            username: this.formData.get('username'),
            password: this.formData.get('password'),
            email: this.formData.get('email'),
            csrfToken: this.csrfToken
        }
    }

    actualizarCsrfToken = (token) => this.csrfToken = token;

    borrarDatosFormulario = () => this.elemento.reset();

    async #validar() {
        if (this.formData.get('password') != this.formData.get('confirm_password')) {
            throw new Error('Las contraseñas no coinciden.');
        }

        const patron = /^[a-zA-Z0-9@]+$/;
        const username = this.formData.get('username');

        if (!patron.test(username)) {
            throw new Error('Nombre de usuario no válido.');
        }

        if (username.length < 6) {
            throw new Error('El nombre de usuario debe tener al menos 6 caracteres.');
        }

        if (this.formData.get('password').length < 6) {
            throw new Error('La contraseña debe tener al menos 6 caracteres.');
        }
    }

    setOnSubmitListener(fn) {
        this.elemento.addEventListener('submit', e => {
            e.preventDefault();
            e.stopPropagation();
            fn();
        });
    }
}

/* =========================================================
   ✅ MODAL ÉXITO — KING•VPN (botón IR al lado del link)
   ========================================================= */
class ModalRegistroExitoso {
    constructor() {
        this.elemento = document.createElement('div');
        this.elemento.className = 'modal fade';

        const loginUrl = window.location.origin + '/login';

        this.elemento.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content kv-modal-king" style="font-family: 'Segoe UI', system-ui, sans-serif;">
                    
                    <style>
                        .kv-modal-king{
                            border-radius: 22px !important;
                            overflow: hidden;
                            border: 2px solid rgba(255,211,106,.45) !important;
                            background:
                                radial-gradient(620px 260px at 18% 12%, rgba(255,211,106,.16), transparent 60%),
                                radial-gradient(620px 260px at 86% 10%, rgba(212,175,55,.14), transparent 62%),
                                linear-gradient(145deg, rgba(60, 35, 9, .94), rgba(18, 10, 2, .98)) !important;
                            box-shadow: 0 18px 55px rgba(0,0,0,.72), 0 0 0 1px rgba(255,211,106,.10);
                            color: rgba(255,246,214,.96) !important;
                        }
                        .kv-modal-king .modal-header{
                            border-bottom: 1px solid rgba(255,211,106,.28) !important;
                            background: linear-gradient(90deg, rgba(255,211,106,.16), rgba(18,10,2,.94), rgba(212,175,55,.18)) !important;
                            padding: 14px 16px;
                        }
                        .kv-modal-king .modal-title{
                            margin:0;
                            letter-spacing: .16em;
                            text-transform: uppercase;
                            font-weight: 950;
                            color: rgba(255,211,106,.98) !important;
                            text-shadow: 0 0 12px rgba(255,211,106,.35);
                        }
                        .kv-modal-king .btn-close{
                            background:none !important;
                            opacity: 1 !important;
                            width: 46px;
                            height: 40px;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            border-radius: 14px;
                            border: 1px solid rgba(255,211,106,.32);
                            box-shadow: 0 0 0 1px rgba(255,211,106,.12), 0 10px 24px rgba(0,0,0,.55);
                            position: relative;
                            overflow:hidden;
                        }
                        .kv-modal-king .btn-close::before{
                            content:"✕";
                            font-size: 1.28rem;
                            font-weight: 950;
                            color: rgba(255,211,106,.98);
                            text-shadow: 0 0 12px rgba(255,211,106,.65);
                            line-height:1;
                        }
                        .kv-modal-king .modal-body{ padding: 16px; }

                        .kv-box{
                            border-radius: 16px;
                            border: 1px solid rgba(255,211,106,.22);
                            background:
                                radial-gradient(520px 200px at 18% 10%, rgba(255,211,106,.12), transparent 60%),
                                rgba(22, 12, 3, .46);
                            box-shadow: inset 0 0 0 1px rgba(255,255,255,.03), 0 12px 30px rgba(0,0,0,.50);
                            padding: 14px;
                            text-align:left;
                        }
                        .kv-kicker{
                            display:block;
                            font-size: .72rem;
                            letter-spacing: .16em;
                            text-transform: uppercase;
                            color: rgba(255,226,170,.72);
                            font-weight: 950;
                            margin-bottom: 10px;
                        }
                        .kv-row{
                            display:flex;
                            align-items:center;
                            justify-content:space-between;
                            gap: 10px;
                            padding: 10px 12px;
                            border-radius: 14px;
                            border: 1px solid rgba(255,211,106,.14);
                            background: rgba(0,0,0,.16);
                            margin-bottom: 8px;
                            overflow:hidden;
                        }
                        .kv-row b{ color: rgba(255,211,106,.98); font-weight: 950; }
                        .kv-row span{ color: rgba(255,246,214,.96); font-weight: 900; }

                        .kv-links{
                            margin-top: 10px;
                            display:grid;
                            gap: 8px;
                        }

                        /* ✅ Link + Botón IR en la misma fila */
                        .kv-link-row{
                            display:flex;
                            gap: 10px;
                            align-items: stretch;
                        }
                        .kv-link{
                            flex: 1 1 auto;
                            display:flex;
                            align-items:center;
                            justify-content:space-between;
                            gap: 10px;
                            padding: 10px 12px;
                            border-radius: 14px;
                            border: 1px solid rgba(255,211,106,.18);
                            background: rgba(0,0,0,.14);
                            text-decoration:none;
                            color: rgba(255,246,214,.96) !important;
                            word-break: break-word;
                            overflow:hidden;
                        }
                        .kv-link small{
                            color: rgba(255,226,170,.70);
                            letter-spacing: .08em;
                            text-transform: uppercase;
                            font-weight: 950;
                            flex: 0 0 auto;
                        }

                        .kv-go{
                            flex: 0 0 auto;
                            min-width: 72px;
                            border-radius: 14px;
                            border: none;
                            padding: 0 14px;
                            background: linear-gradient(145deg, rgba(255,211,106,.98), rgba(212,175,55,.98));
                            color: rgba(0,0,0,.95);
                            font-weight: 950;
                            letter-spacing: .14em;
                            text-transform: uppercase;
                            box-shadow: 0 0 0 1px rgba(255,211,106,.25), 0 14px 28px rgba(0,0,0,.55);
                            cursor: pointer;
                            position: relative;
                            overflow: hidden;
                            transition: transform .10s ease, filter .18s ease;
                        }
                        .kv-go::after{
                            content:"";
                            position:absolute;
                            top:-40%; left:-120%;
                            width: 80%;
                            height: 180%;
                            transform: rotate(18deg);
                            background: linear-gradient(90deg, transparent, rgba(255,255,255,.14), transparent);
                            transition: left .55s ease;
                            pointer-events:none;
                        }
                        .kv-go:hover{
                            transform: translateY(-1px);
                            filter: brightness(1.06);
                        }
                        .kv-go:hover::after{ left: 140%; }
                        .kv-go:active{ transform: translateY(0); filter: brightness(1.00); }

                        @media (max-width: 420px){
                            .kv-go{ min-width: 64px; padding: 0 12px; }
                        }

                        .kv-img{
                            width: 160px;
                            height: 160px;
                            border-radius: 18px;
                            border: 1px solid rgba(255,211,106,.22);
                            box-shadow: 0 0 0 1px rgba(255,211,106,.10), 0 14px 34px rgba(0,0,0,.55);
                            object-fit: cover;
                        }

                        .kv-ok{
                            margin: 12px 0 0;
                            color: rgba(255,211,106,.98);
                            font-weight: 950;
                            letter-spacing: .10em;
                            text-transform: uppercase;
                            text-align:center;
                            text-shadow: 0 0 16px rgba(255,211,106,.22);
                        }

                        .kv-modal-king .modal-footer{
                            border-top: 1px solid rgba(255,211,106,.28) !important;
                            background: rgba(0,0,0,.10);
                            padding: 12px 16px;
                        }
                        .kv-btn{
                            width:100%;
                            border-radius: 14px !important;
                            border:none !important;
                            padding: 12px 14px !important;
                            background: linear-gradient(145deg, rgba(255,211,106,.98), rgba(212,175,55,.98)) !important;
                            color: rgba(0,0,0,.95) !important;
                            font-weight: 950 !important;
                            letter-spacing: .14em !important;
                            text-transform: uppercase !important;
                            box-shadow: 0 0 0 1px rgba(255,211,106,.35), 0 16px 36px rgba(255,211,106,.18);
                        }
                    </style>

                    <div class="modal-header">
                        <h5 class="modal-title">Registro exitoso</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                    </div>

                    <div class="modal-body text-center">
                        <img class="kv-img" src="https://i.ibb.co/GvdtDQyy/IMG-20251211-WA0002.jpg" alt="KING•VPN">

                        <div class="kv-ok">Acceso creado con éxito</div>

                        <div class="kv-box mt-3">
                            <span class="kv-kicker">Datos de acceso</span>

                            <div class="kv-row">
                                <b>👤 Usuario</b>
                                <span class="__username"></span>
                            </div>

                            <div class="kv-row">
                                <b>🔑 Contraseña</b>
                                <span class="__password"></span>
                            </div>

                            <div class="kv-links">
                                <!-- ✅ Link + botón IR -->
                                <div class="kv-link-row">
                                    <a class="kv-link" href="${loginUrl}" target="_self" rel="noopener">
                                        <small>Link</small>
                                        <span>${loginUrl}</span>
                                    </a>
                                    <button type="button" class="kv-go" data-go="${loginUrl}">IR</button>
                                </div>

                                <a class="kv-link" href="https://youtu.be/hz2zCdgvRzA" target="_blank" rel="noopener">
                                    <small>Contacto</small>
                                    <span>INTER•KING</span>
                                </a>

                                <a class="kv-link" href="https://whatsapp.com/channel/0029VbBKUIAL7UVQLgYs5S1b" target="_blank" rel="noopener">
                                    <small>Canal</small>
                                    <span>KINGVPN</span>
                                </a>

                                <a class="kv-link" href="https://whatsapp.com/channel/0029VbCMLYg0gcfCTBaHhT2N" target="_blank" rel="noopener">
                                    <small>Grupo</small>
                                    <span>Telegram</span>
                                </a>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button type="button" data-bs-dismiss="modal" class="kv-btn">CERRAR</button>
                    </div>

                </div>
            </div>
        `;

        this.modal = new bootstrap.Modal(this.elemento);

        // ✅ CLICK “IR” → navega al link (misma dirección que se muestra)
        this.elemento.addEventListener('click', (e) => {
            const btn = e.target.closest('.kv-go');
            if (!btn) return;
            const url = btn.getAttribute('data-go');
            if (url) window.location.href = url;
        });
    }

    setData(data) {
        this.elemento.querySelector('.__username').innerHTML = data.username;
        this.elemento.querySelector('.__password').innerHTML = data.password;
    }

    show() { this.modal.show(); }
    hide() { this.modal.hide(); }
}

/* =========================================================
   ✅ MODAL ERROR — KING•VPN (solo visual, misma lógica)
   ========================================================= */
class ModalRegistroError {
    constructor() {
        this.elemento = document.createElement('div');
        this.elemento.className = 'modal fade';

        this.elemento.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content kv-modal-king" style="font-family: 'Segoe UI', system-ui, sans-serif;">

                    <style>
                        .kv-modal-king{
                            border-radius: 22px !important;
                            overflow: hidden;
                            border: 2px solid rgba(255,211,106,.45) !important;
                            background:
                                radial-gradient(620px 260px at 18% 12%, rgba(255,211,106,.16), transparent 60%),
                                radial-gradient(620px 260px at 86% 10%, rgba(212,175,55,.14), transparent 62%),
                                linear-gradient(145deg, rgba(60, 35, 9, .94), rgba(18, 10, 2, .98)) !important;
                            box-shadow: 0 18px 55px rgba(0,0,0,.72), 0 0 0 1px rgba(255,211,106,.10);
                            color: rgba(255,246,214,.96) !important;
                        }
                        .kv-modal-king .modal-header{
                            border-bottom: 1px solid rgba(255,211,106,.28) !important;
                            background: linear-gradient(90deg, rgba(255,211,106,.16), rgba(18,10,2,.94), rgba(212,175,55,.18)) !important;
                            padding: 14px 16px;
                        }
                        .kv-modal-king .modal-title{
                            margin:0;
                            letter-spacing: .16em;
                            text-transform: uppercase;
                            font-weight: 950;
                            color: rgba(255,211,106,.98) !important;
                            text-shadow: 0 0 12px rgba(255,211,106,.35);
                        }
                        .kv-modal-king .btn-close{
                            background:none !important;
                            opacity: 1 !important;
                            width: 46px;
                            height: 40px;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            border-radius: 14px;
                            border: 1px solid rgba(255,211,106,.32);
                            box-shadow: 0 0 0 1px rgba(255,211,106,.12), 0 10px 24px rgba(0,0,0,.55);
                            position: relative;
                            overflow:hidden;
                        }
                        .kv-modal-king .btn-close::before{
                            content:"✕";
                            font-size: 1.28rem;
                            font-weight: 950;
                            color: rgba(255,211,106,.98);
                            text-shadow: 0 0 12px rgba(255,211,106,.65);
                            line-height:1;
                        }
                        .kv-modal-king .modal-body{ padding: 16px; }

                        .kv-err-title{
                            color: rgba(255,140,140,.98);
                            font-weight: 950;
                            letter-spacing: .14em;
                            text-transform: uppercase;
                            margin-bottom: 10px;
                            text-shadow: 0 0 12px rgba(255,90,90,.18);
                        }

                        .kv-msg{
                            border-radius: 16px;
                            border: 1px solid rgba(255,90,90,.22);
                            background:
                                radial-gradient(520px 200px at 18% 10%, rgba(255,90,90,.10), transparent 60%),
                                rgba(22, 12, 3, .42);
                            padding: 14px;
                            color: rgba(255,246,214,.96);
                        }

                        .kv-links{
                            margin-top: 12px;
                            display:grid;
                            gap: 8px;
                        }
                        .kv-link{
                            display:flex;
                            align-items:center;
                            justify-content:space-between;
                            gap: 10px;
                            padding: 10px 12px;
                            border-radius: 14px;
                            border: 1px solid rgba(255,211,106,.18);
                            background: rgba(0,0,0,.14);
                            text-decoration:none;
                            color: rgba(255,246,214,.96) !important;
                        }
                        .kv-link small{
                            color: rgba(255,226,170,.70);
                            letter-spacing: .08em;
                            text-transform: uppercase;
                            font-weight: 950;
                        }

                        .kv-modal-king .modal-footer{
                            border-top: 1px solid rgba(255,211,106,.28) !important;
                            background: rgba(0,0,0,.10);
                            padding: 12px 16px;
                        }
                        .kv-btn{
                            width:100%;
                            border-radius: 14px !important;
                            border:none !important;
                            padding: 12px 14px !important;
                            background: linear-gradient(145deg, rgba(255,211,106,.98), rgba(212,175,55,.98)) !important;
                            color: rgba(0,0,0,.95) !important;
                            font-weight: 950 !important;
                            letter-spacing: .14em !important;
                            text-transform: uppercase !important;
                            box-shadow: 0 0 0 1px rgba(255,211,106,.35), 0 16px 36px rgba(255,211,106,.18);
                        }
                    </style>

                    <div class="modal-header">
                        <h5 class="modal-title">Error</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                    </div>

                    <div class="modal-body text-center">
                        <div class="kv-err-title">No se pudo crear el acceso</div>

                        <div class="kv-msg">
                            <span class="__error_message">
                                <p class="mb-0">Contacte al soporte.</p>
                            </span>

                            <div class="kv-links">
                                <a class="kv-link" href="https://t.me/+9-aFIbCVPUIxNjdh" target="_blank" rel="noopener">
                                    <small>Grupo</small>
                                    <span>Telegram</span>
                                </a>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button type="button" data-bs-dismiss="modal" class="kv-btn">CERRAR</button>
                    </div>

                </div>
            </div>
        `;

        this.modal = new bootstrap.Modal(this.elemento);
    }

    setMessage(data) {
        this.elemento.querySelector('.__error_message').innerHTML = `<p class="mb-0">${data}</p>`;
    }

    show() { this.modal.show(); }
    hide() { this.modal.hide(); }
}

const iniciarLoaderBoton = () => {
    const loader = document.querySelector('.__btn_loader');
    const text = document.querySelector('.__btn_text');
    text.parentElement.setAttribute('disabled', '');
    loader.classList.remove('d-none');
    text.classList.add('d-none');
}

const detenerLoaderBoton = () => {
    const loader = document.querySelector('.__btn_loader');
    const text = document.querySelector('.__btn_text');
    text.parentElement.removeAttribute('disabled');
    loader.classList.add('d-none');
    text.classList.remove('d-none');
}

const main = async () => {
    const modalExito = new ModalRegistroExitoso();
    const modalError = new ModalRegistroError();

    const formRegistro = new FormularioRegistro();
    const servicioRegistro = new ServicioRegistro();

    const registroExitoso = async (formData) => {
        try {
            modalExito.setData(formData);
            modalExito.show();
            formRegistro.borrarDatosFormulario();
        } catch {
            modalError.show();
        }
    }

    const iniciarProcesoRegistro = async () => {
        iniciarLoaderBoton();
        try {
            const data = await formRegistro.obtenerDatos();
            const registro = await servicioRegistro.registrar({ ...data, formularioRegistro: formRegistro });
            await registroExitoso(data, registro);
        } catch (error) {
            showToastError(error);
            // Si querés que el error también salga en modal, descomentá:
            // modalError.setMessage(error?.message || error);
            // modalError.show();
        } finally {
            detenerLoaderBoton();
        }
    };

    formRegistro.setOnSubmitListener(() => iniciarProcesoRegistro());
}

main();
