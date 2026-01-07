import AbsDialog from "./dialog.js";

export default class DialogConfig extends AbsDialog {
    render() {
        this.dialogHeader.setTitle('DIALOG DE CONFIGURACIÓN');
        this.dialogHeader.setCloseButton(e => {
            e.stopPropagation();
            this.close();
        });
        this.dialogContent.element.innerText = 'DATOS DE CONFIGURACIPN';
        this.dialog.setStyle({ width: '350px'});
        super.render();
    }
}
