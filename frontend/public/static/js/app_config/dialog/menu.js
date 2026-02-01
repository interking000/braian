import AbsDialog from './dialog.js';
import DialogDefault from './default.js';
import DialogConfig from './config.js';
import DialogLogger from './logger.js';

class MenuItem {
    constructor(text, icon, fn) {
        this.element = document.createElement('div');

        // ✅ Base PREMIUM (oro + marrón, estilo KING•VPN)
        this.setStyle({
            width: '100%',
            height: '44px',
            display: 'flex',
            padding: '0 14px',
            alignItems: 'center',
            cursor: 'pointer',
            borderRadius: '14px',
            marginBottom: '10px',
            position: 'relative',
            overflow: 'hidden',
            userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',

            // Fondo premium
            background:
                'radial-gradient(240px 90px at 20% 30%, rgba(255,231,166,.14), transparent 65%),' +
                'linear-gradient(145deg, rgba(58,36,0,.40), rgba(14,10,2,.22))',
            color: 'rgba(255,242,194,.96)',
            border: '1px solid rgba(255,231,166,.18)',
            boxShadow: '0 14px 34px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,231,166,.06)',
            letterSpacing: '.06em',
            fontWeight: '900',
            textTransform: 'uppercase',
            transition: 'transform .18s ease, filter .18s ease, border-color .18s ease, background .18s ease',
        });

        // ✅ Shine dorado (overlay)
        const shine = document.createElement('div');
        shine.className = 'kv-menuitem-shine';
        Object.assign(shine.style, {
            position: 'absolute',
            inset: '-2px',
            background: 'linear-gradient(120deg, transparent 42%, rgba(255,255,255,.18) 50%, transparent 58%)',
            transform: 'translateX(-140%)',
            opacity: '.70',
            pointerEvents: 'none',
            animation: 'kvMenuSheen 6.4s linear infinite',
        });
        this.element.appendChild(shine);

        // ✅ Icono
        const iconElement = document.createElement('i');
        iconElement.className = icon;
        Object.assign(iconElement.style, {
            fontSize: '18px',
            marginRight: '10px',
            color: 'rgba(255,231,166,.95)',
            filter: 'drop-shadow(0 0 10px rgba(255,215,120,.12))',
            flex: '0 0 auto',
            position: 'relative',
            zIndex: '1',
        });

        // ✅ Texto (evita que el shine tape el texto)
        const textElement = document.createElement('span');
        textElement.textContent = text;
        Object.assign(textElement.style, {
            position: 'relative',
            zIndex: '1',
            fontSize: '.86rem',
            lineHeight: '1',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: '1',
        });

        this.element.appendChild(iconElement);
        this.element.appendChild(textElement);

        // ✅ Click
        this.element.addEventListener('click', e => {
            e.stopPropagation();
            fn();
        });

        // ✅ Hover PREMIUM
        this.element.addEventListener('mouseover', () => {
            this.element.style.transform = 'translateY(-1px)';
            this.element.style.filter = 'brightness(1.06)';
            this.element.style.borderColor = 'rgba(255,231,166,.28)';
            this.element.style.background =
                'radial-gradient(260px 92px at 22% 30%, rgba(255,231,166,.18), transparent 64%),' +
                'radial-gradient(260px 92px at 78% 30%, rgba(255,211,106,.12), transparent 64%),' +
                'linear-gradient(145deg, rgba(255,211,106,.16), rgba(184,138,26,.10))';

            shine.style.opacity = '.92';
            iconElement.style.color = 'rgba(255,231,166,.98)';
            textElement.style.color = 'rgba(255,242,194,.98)';
        });

        this.element.addEventListener('mouseout', () => {
            this.element.style.transform = 'translateY(0)';
            this.element.style.filter = 'brightness(1)';
            this.element.style.borderColor = 'rgba(255,231,166,.18)';
            this.element.style.background =
                'radial-gradient(240px 90px at 20% 30%, rgba(255,231,166,.14), transparent 65%),' +
                'linear-gradient(145deg, rgba(58,36,0,.40), rgba(14,10,2,.22))';

            shine.style.opacity = '.70';
            iconElement.style.color = 'rgba(255,231,166,.95)';
            textElement.style.color = 'rgba(255,242,194,.96)';
        });

        // ✅ Press feedback
        this.element.addEventListener('mousedown', () => {
            this.element.style.transform = 'translateY(0) scale(0.995)';
            this.element.style.filter = 'brightness(1.02)';
        });

        this.element.addEventListener('mouseup', () => {
            this.element.style.transform = 'translateY(-1px)';
            this.element.style.filter = 'brightness(1.06)';
        });

        // ✅ Inyectar keyframes 1 sola vez
        MenuItem.injectPremiumCSS();
    }

    static injectPremiumCSS() {
        if (document.getElementById('kv-menuitem-premium-css')) return;

        const style = document.createElement('style');
        style.id = 'kv-menuitem-premium-css';
        style.textContent = `
          @keyframes kvMenuSheen {
            0% { transform: translateX(-140%); }
            100% { transform: translateX(140%); }
          }
        `;
        document.head.appendChild(style);
    }

    setStyle(style) {
        Object.keys(style).forEach(key => {
            this.element.style[key] = style[key];
        });
    }
}

class DialogMenu extends AbsDialog {
    constructor(items = []) {
        super();
        this.renderItems(items);
    }

    renderItems(items) {
        items.forEach(item => {
            this.dialogContent.element.appendChild(
                new MenuItem(item.text, item.icon, item.fn).element
            );
        });
    }

    render() {
        // ✅ Título más pro
        this.dialogHeader.setTitle('ELEGÍ UNA OPCIÓN');
        this.dialogHeader.setCloseButton(e => {
            e.stopPropagation();
            this.close();
        });

        // ✅ Padding más prolijo
        this.dialogContent.element.style.padding = '10px';

        // ✅ Intento de “marco premium” para el modal completo
        // (si AbsDialog no expone contenedor, no rompe)
        try {
            const host =
                this.dialog?.element ||
                this.element ||
                this.dialogContent?.element?.parentElement;

            if (host) {
                host.style.borderRadius = '22px';
                host.style.border = '1px solid rgba(255,231,166,.18)';
                host.style.boxShadow = '0 25px 70px rgba(30,18,0,.55)';
                host.style.background =
                    'radial-gradient(900px 420px at 18% 10%, rgba(255,211,106,.18), transparent 62%),' +
                    'radial-gradient(900px 420px at 82% 8%, rgba(212,175,55,.14), transparent 62%),' +
                    'linear-gradient(180deg, rgba(14,10,2,.86), rgba(8,6,2,.92))';
                host.style.backdropFilter = 'blur(10px)';
            }
        } catch { }

        super.render();
    }
}

class DialogMenuImpl {
    constructor() {
        this.dialogDefault = new DialogDefault();
        this.dialogConfig = new DialogConfig();
        this.dialogLogger = new DialogLogger();
        this.dialogMenu = new DialogMenu(this.__createItems());
    }

    __createItems() {
        return [
            {
                text: 'Colores de los modald',
                icon: 'bi bi-chat',
                fn: () => {
                    console.log('Item 1');
                    this.dialogDefault.render();
                }
            },
            {
                text: 'Color de servidores',
                icon: 'bi bi-gear-fill',
                fn: () => {
                    console.log('Item 2');
                    this.dialogConfig.render();
                }
            },
            {
                text: 'Color del log',
                icon: 'bi bi-journal-text',
                fn: () => {
                    console.log('Item 3');
                    this.dialogLogger.render();
                }
            },
            {
                text: 'Salir',
                icon: 'bi bi-x-lg',
                fn: () => {
                    console.log('Item 4');
                    this.dialogMenu.close();
                }
            },
        ];
    }

    render() {
        this.dialogMenu.render();
    }
}

export { DialogMenu, MenuItem };
export default DialogMenuImpl;
