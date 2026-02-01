import { setPickerColor } from '../../picker.js'

/**
 * ✅ Golden Premium UI (scoped por modal)
 * - No rompe tu panel: sigue usando Bootstrap modal
 * - Estilos independientes por ventana (CSS variables dentro del root)
 * - Botones y header dorados + glass + bordes premium
 */
class CategoryModal {
  constructor(form) {
    this.form = form

    // dialog (bootstrap espera .modal-dialog dentro de .modal)
    this.element = document.createElement('div')
    this.element.classList.add('modal-dialog', 'modal-dialog-centered')
    this.element.setAttribute('role', 'document')

    // ✅ UI GOLDEN (solo markup; el estilo lo inyectamos scoped al root)
    this.element.innerHTML = `
      <div class="modal-content kv-gold-content">
        <div class="modal-header kv-gold-header">
          <div class="kv-gold-titlewrap">
            <div class="kv-gold-badge" aria-hidden="true">✦</div>
            <div class="kv-gold-titles">
              <h5 class="modal-title kv-gold-title">Categoría</h5>
              <small class="kv-gold-sub">Clasifica y ordena tus servidores por categorias</small>
            </div>
          </div>

          <button type="button" class="btn-close kv-gold-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>

        <div class="modal-body kv-gold-body"></div>

        <div class="modal-footer kv-gold-footer d-flex justify-content-between flex-nowrap gap-2">
          <button type="button" class="btn kv-gold-btn kv-gold-btn-ghost w-100" data-bs-dismiss="modal">
            Cerrar
          </button>
          <button type="button" class="btn kv-gold-btn kv-gold-btn-primary w-100">
            Guardar
          </button>
        </div>
      </div>
    `
  }

  setOnSave(fn) {
    const button = this.element.querySelector('.modal-footer button:last-child')
    button.addEventListener('click', fn)
  }

  show() {
    // ✅ Root modal
    this._root = document.createElement('div')
    this._root.classList.add('modal', 'fade', 'kv-gold-modal')
    this._root.setAttribute('tabindex', '-1')

    // ✅ Variables independientes POR MODAL (no afectan otros modales)
    // Podés ajustar estos valores sin tocar el resto del panel.
    this._root.style.setProperty('--kv-bg0', '#07060b')
    this._root.style.setProperty('--kv-bg1', '#0b0a12')
    this._root.style.setProperty('--kv-text', 'rgba(255,252,245,.94)')
    this._root.style.setProperty('--kv-muted', 'rgba(255,252,245,.70)')

    this._root.style.setProperty('--kv-gold1', '#ffd36b')
    this._root.style.setProperty('--kv-gold2', '#ffb800')
    this._root.style.setProperty('--kv-gold3', '#ffe7a6')

    this._root.style.setProperty('--kv-border', 'rgba(255,211,107,.18)')
    this._root.style.setProperty('--kv-border2', 'rgba(255,255,255,.10)')
    this._root.style.setProperty('--kv-shadow', '0 60px 180px rgba(0,0,0,.75)')
    this._root.style.setProperty('--kv-glow', '0 0 22px rgba(255,184,0,.22), 0 0 55px rgba(255,211,107,.12)')

    // ✅ Backdrop un poco más premium
    this._root.style.setProperty('--bs-backdrop-opacity', '0.78')

    // ✅ Inyectar CSS scoped (solo dentro de este modal)
    this._injectScopedCssOnce()

    // Render del form
    this.element.querySelector('.modal-body').appendChild(this.form.render())
    this._root.appendChild(this.element)

    // Add al DOM
    document.body.appendChild(this._root)

    this.modal = new bootstrap.Modal(this._root)
    this.modal.show()

    // Limpieza al cerrar (evita acumular nodos)
    this._root.addEventListener(
      'hidden.bs.modal',
      () => {
        try {
          this._root.remove()
        } catch {}
      },
      { once: true }
    )
  }

  hide() {
    if (this.modal) this.modal.hide()
  }

  _injectScopedCssOnce() {
    if (this._root.querySelector('style[data-kv-gold="1"]')) return

    const st = document.createElement('style')
    st.setAttribute('data-kv-gold', '1')
    st.textContent = `
      /* ✅ TODO scoped a .kv-gold-modal para no tocar otros modales */
      .kv-gold-modal .modal-dialog { max-width: 640px; }
      .kv-gold-modal .kv-gold-content{
        border-radius: 22px;
        overflow: hidden;
        border: 1px solid var(--kv-border2);
        box-shadow: var(--kv-shadow);
        color: var(--kv-text);
        background:
          radial-gradient(900px 420px at 12% 0%, rgba(255,184,0,.18), transparent 60%),
          radial-gradient(900px 420px at 88% 10%, rgba(255,211,107,.12), transparent 60%),
          linear-gradient(180deg, rgba(8,7,12,.98), rgba(8,7,12,.92));
        backdrop-filter: blur(14px);
        position: relative;
      }

      .kv-gold-modal .kv-gold-content::before{
        content:"";
        position:absolute; inset:-2px;
        background:
          linear-gradient(90deg, transparent, rgba(255,184,0,.35), transparent),
          linear-gradient(180deg, transparent, rgba(255,211,107,.18), transparent);
        opacity:.14;
        pointer-events:none;
        transform: rotate(6deg);
      }

      .kv-gold-modal .kv-gold-header{
        border: 0;
        padding: 14px 14px 10px;
        border-bottom: 1px solid rgba(255,255,255,.10);
        background: rgba(0,0,0,.16);
      }

      .kv-gold-modal .kv-gold-titlewrap{
        display:flex; align-items:center; gap:10px;
      }

      .kv-gold-modal .kv-gold-badge{
        width: 40px; height: 40px;
        border-radius: 14px;
        display:flex; align-items:center; justify-content:center;
        color: rgba(10,8,12,.92);
        font-weight: 999;
        letter-spacing: .12em;
        background: linear-gradient(135deg, var(--kv-gold1), var(--kv-gold2));
        box-shadow: var(--kv-glow);
        border: 1px solid rgba(255,255,255,.20);
      }

      .kv-gold-modal .kv-gold-title{
        margin:0;
        font-weight: 999;
        letter-spacing: .14em;
        text-transform: uppercase;
        font-size: .92rem;
      }
      .kv-gold-modal .kv-gold-sub{
        display:block;
        margin-top: 2px;
        color: var(--kv-muted);
        letter-spacing: .06em;
        font-size: .82rem;
      }

      .kv-gold-modal .kv-gold-close{
        filter: invert(1) brightness(1.25);
        opacity:.92;
      }

      .kv-gold-modal .kv-gold-body{
        padding: 14px;
      }

      /* ✅ Inputs premium (scoped) */
      .kv-gold-modal .form-label{
        color: rgba(255,252,245,.86);
        font-weight: 900;
        letter-spacing: .06em;
        text-transform: uppercase;
        font-size: .78rem;
        margin-bottom: 6px;
      }
      .kv-gold-modal .form-control,
      .kv-gold-modal .form-select{
        background: rgba(0,0,0,.22) !important;
        border: 1px solid rgba(255,255,255,.12) !important;
        color: rgba(255,252,245,.94) !important;
        border-radius: 14px !important;
        box-shadow: inset 0 0 0 1px rgba(255,184,0,.06);
      }
      .kv-gold-modal .form-control:focus,
      .kv-gold-modal .form-select:focus{
        border-color: rgba(255,211,107,.40) !important;
        box-shadow: 0 0 0 3px rgba(255,184,0,.16) !important;
      }

      /* ✅ Footer & botones */
      .kv-gold-modal .kv-gold-footer{
        border: 0;
        padding: 12px 14px 14px;
        border-top: 1px solid rgba(255,255,255,.10);
        background: rgba(0,0,0,.14);
      }

      .kv-gold-modal .kv-gold-btn{
        border-radius: 999px !important;
        padding: .64rem 1.05rem !important;
        font-weight: 999 !important;
        letter-spacing: .14em;
        text-transform: uppercase;
        transition: transform .14s ease, filter .14s ease, box-shadow .14s ease;
      }

      .kv-gold-modal .kv-gold-btn:active{ transform: translateY(0px); filter: brightness(.98); }
      .kv-gold-modal .kv-gold-btn:hover{ transform: translateY(-1px); filter: brightness(1.03); }

      .kv-gold-modal .kv-gold-btn-ghost{
        background: rgba(255,255,255,.06) !important;
        border: 1px solid rgba(255,255,255,.14) !important;
        color: rgba(255,252,245,.92) !important;
      }

      .kv-gold-modal .kv-gold-btn-primary{
        border: 1px solid rgba(255,255,255,.18) !important;
        color: rgba(10,8,12,.95) !important;
        background:
          radial-gradient(140px 80px at 20% 30%, rgba(255,255,255,.18), transparent 60%),
          linear-gradient(135deg, var(--kv-gold1), var(--kv-gold2)) !important;
        box-shadow: var(--kv-glow);
      }

      /* ✅ Validación bootstrap */
      .kv-gold-modal .was-validated .form-control:invalid,
      .kv-gold-modal .was-validated .form-select:invalid{
        border-color: rgba(255,80,80,.55) !important;
        box-shadow: 0 0 0 3px rgba(255,80,80,.12) !important;
      }
    `
    this._root.appendChild(st)
  }
}

class CategoryForm {
  __html = `
    <div class="mb-3 row g-2">
      <div class="col-md-6">
        <label class="form-label">Nombre</label>
        <input type="text" class="__name form-control" required>
      </div>
      <div class="col-md-6">
        <label class="form-label">Orden</label>
        <input type="number" class="__order form-control" required>
      </div>
    </div>

    <div class="mb-2 row g-2">
      <div class="col-md-6">
        <label class="form-label">Color</label>
        <input type="text" class="__color form-control" required>
      </div>
      <div class="col-md-6">
        <label class="form-label">Estado</label>
        <select class="__status form-select">
          <option value="ACTIVE">ACTIVO</option>
          <option value="INACTIVE">INACTIVO</option>
        </select>
      </div>
    </div>
  `

  constructor(category) {
    this.category = category

    this.element = document.createElement('form')
    this.element.classList.add('form-group')
    this.element.innerHTML = this.__html

    this.name = this.element.querySelector('.__name')
    this.order = this.element.querySelector('.__order')

    this.color = this.element.querySelector('.__color')
    this.status = this.element.querySelector('.__status')

    // ✅ Mantengo tu setPickerColor (no rompo el picker existente)
    setPickerColor(this.color, this.category.color, (color) => {
      this.category.color = color
      this.color.value = this.category.color
    })

    this.setup()
  }

  setup() {
    this.name.addEventListener('input', (e) => {
      this.category.name = e.target.value
    })

    this.order.addEventListener('input', (e) => {
      this.category.sorter = e.target.value
    })

    this.color.addEventListener('input', (e) => {
      this.category.color = e.target.value
    })

    this.status.addEventListener('input', (e) => {
      this.category.status = e.target.value
    })
  }

  validate() {
    if (this.element.checkValidity()) return true
    this.element.classList.add('was-validated')
    return false
  }

  render() {
    this.name.value = this.category.name
    this.order.value = this.category.sorter
    this.color.value = this.category.color
    this.status.value = this.category.status
    return this.element
  }
}

export { CategoryModal, CategoryForm }
