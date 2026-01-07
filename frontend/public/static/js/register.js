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

class ModalRegistroExitoso {
    constructor() {
        this.elemento = document.createElement('div');
        this.elemento.className = 'modal fade';
        this.elemento.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content bg-black-glass text-white fw-bold" style="font-family: 'Segoe UI', sans-serif;">
                    <div class="modal-header">
                        <h5 class="modal-title text-3d">✨¡Felicidades!✨</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                    </div>
                    <div class="modal-body text-center">
                        <img src="https://i.ibb.co/GvdtDQyy/IMG-20251211-WA0002.jpg" width="200" height="200" style="border-radius: 20px; box-shadow: 0 0 20px #0bc54d;">
                        <p class="fs-2 text-success text-3d mt-3">Acceso creado con éxito.</p>
                        <div class="form-control bg-black-glass text-white fw-bold __data" style="overflow-y:auto; border-radius:15px;">
                            <p class="mb-2">👤 Usuario: <span class="__username"></span></p>
                            <p class="mb-2">🔑 Contraseña: <span class="__password"></span></p>
                            <p class="mb-2">🔗 Link de acceso: <a href="${window.location.origin + '/login'}" class="text-reset">${window.location.origin + '/login'}</a></p>
                            <p class="mb-2">Contacto: <a href="https://youtu.be/hz2zCdgvRzA" target="_blank" class="text-reset">INTER•KING</a></p>
                            <ul class="mt-4">
                                <li>Canal: <a href="https://whatsapp.com/channel/0029VbBKUIAL7UVQLgYs5S1b" class="text-reset">KINGVPN</a></li>
                                <li>Grupo: <a href="https://t.me/+9-aFIbCVPUIxNjdh" class="text-reset">TelegramGrupo</a></li>
                            </ul>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" data-bs-dismiss="modal" class="btn btn-dark w-100 border fw-bold">CERRAR</button>
                    </div>
                </div>
            </div>
        `;
        this.modal = new bootstrap.Modal(this.elemento);
    }

    setData(data) {
        this.elemento.querySelector('.__username').innerHTML = data.username;
        this.elemento.querySelector('.__password').innerHTML = data.password;
    }

    show() { this.modal.show(); }
    hide() { this.modal.hide(); }
}

class ModalRegistroError {
    constructor() {
        this.elemento = document.createElement('div');
        this.elemento.className = 'modal fade';
        this.elemento.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content bg-black-glass text-white fw-bold" style="font-family: 'Segoe UI', sans-serif;">
                    <div class="modal-header">
                        <h5 class="modal-title text-3d text-danger">ERROR</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                    </div>
                    <div class="modal-body text-center">
                        <span class="__error_message">
                            <p class="fs-3 text-danger text-3d">No se pudo crear su acceso. Contacte al soporte.</p>
                        </span>
                        <ul class="mt-3">
                            <li>Grupo: <a href="hhttps://t.me/+9-aFIbCVPUIxNjdh" class="text-reset">DTunnel</a></li>
                            <li>Grupo: <a href="https://t.me/+9-aFIbCVPUIxNjdh" class="text-reset">Grupo</a></li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
        this.modal = new bootstrap.Modal(this.elemento);
    }

    setMessage(data) {
        this.elemento.querySelector('.__error_message').innerHTML = `<p class="fs-3 text-danger text-3d">${data}</p>`;
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
        } finally {
            detenerLoaderBoton();
        }
    };

    formRegistro.setOnSubmitListener(() => iniciarProcesoRegistro());
}

main();
