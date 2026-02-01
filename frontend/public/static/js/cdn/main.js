import CdnTable, { TableItem } from "./components/table.js";
import Cdn from "./models.js";

import { Observable } from "../common/observer.js";
import { Observer } from "../common/observer.js";

import { ButtonAdd, ButtonDelete } from "./components/buttons.js";
import { CdnForm, CdnModal } from "./modals/cdn.js";
import Status from "./components/status.js";
import Pagination from "../common/pagination.js";

import NoFoundCdn from "./errors/noFoundCdn.js";
import { InternalError } from "../common/errors.js";

class CdnList extends Observable {
    constructor(cdns = []) {
        super();
        this.cdns = cdns
        this.orderBySorter()
    }

    orderBySorter() {
        this.cdns.sort((a, b) => a.sorter - b.sorter)
    }

    add(cdn) {
        if (!cdn.id) cdn.id = "";
        this.cdns.push(cdn)
        this.orderBySorter()
        this.notify('add', cdn)
    }

    remove(cdn) {
        this.cdns = this.cdns.filter(c => c.id !== cdn.id)
        this.orderBySorter()
        this.notify('remove', cdn)
    }

    update(cdn) {
        this.cdns = this.cdns.map(c => c.id === cdn.id ? cdn : c)
        this.orderBySorter()
        this.notify('update', cdn)
    }

    getById(id) {
        return this.cdns.find(c => c.id === id)
    }

    getByStatus(status) {
        return this.cdns.filter(c => c.status === status)
    }

    static fromJson(data) {
        return new CdnList(data.map(Cdn.fromJson))
    }
}

const showSpinner = root => {
    const spinner = `
        <div class="d-flex justify-content-center p-5 __spinner">
            <div class="spinner-border p-5" role="status"></div>
        </div>
    `
    root.innerHTML = spinner
}

let csrfToken = getCsrfTokenHead();

const main = async () => {
    const root = document.getElementById('root')
    showSpinner(root)

    const status = new Status()
    const pagination = new Pagination(document.querySelector('#pagination'))

    status.setOnChange(() => render())
    status.render()

    const getCdns = async () => {
        try {

            const response = await fetch(`/cdn_list?offset=${pagination.offset}&limit=${pagination.limit}`, {
                headers: {}
            })

            const data = await response.json()

            pagination.offset = data.data.offset
            pagination.limit = data.data.limit
            pagination.total = data.data.total
            pagination.mount()

            return CdnList.fromJson(data.data.result)

        } catch (e) {
            const internalError = new InternalError(document.querySelector('.card', e.message))
            internalError.render()
            throw e
        }
    }

    const cdnList = await getCdns()
    pagination.setOnPageChange(async () => {
        showSpinner(root);
        cdnList.cdns = (await getCdns()).cdns
        render()
    })

    const render = () => {
        root.innerHTML = ''
        const cdns = status.getValue() === 'ALL' ?
            cdnList.cdns :
            cdnList.getByStatus(status.getValue())

        if (cdns.length === 0) {
            const noFoundCdn = new NoFoundCdn(root)
            noFoundCdn.render()
            return
        }

        const items = cdns.map(c => {
            const item = new TableItem(c)

            item.setOnClickDelete(() => {
                showAlertConfirm(() => cdnList.remove(c))
            })

            item.setOnClickEdit(() => {
                const form = new CdnForm(c)
                const modal = new CdnModal(form)

                modal.setOnSave(() => {
                    if (!form.validate()) return
                    cdnList.update(c)
                    modal.hide()
                })
                modal.show()
            })

            return item
        })

        const table = new CdnTable(items)
        root.appendChild(table.render())

        const btnDelete = new ButtonDelete()
        btnDelete.setOnClick(() => {
            const items = table.getCheckedItems()
            items.forEach(item => cdnList.remove(item.cdn))
        })

    }

    cdnList.register(new Observer('add', async cdn => {

        render()
        //showToastInfo(`Crinado CDN ${cdn.name}...`)

        const response = await fetch('/cdn', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(cdn)
        });

        const data = await response.json()

        if (response.status == 201) {
            cdn.id = data.cdn_id;
            showToastSuccess(`CDN ${cdn.name} creada con exito!`)
            render()
            return
        }

        showToastError(`Error al crear CDN ${cdn.name}!`)
        cdnList.remove(cdn)
        render()
    }))

    cdnList.register(new Observer('Eliminar', async cdn => {
        render()

        // showToastInfo(`Removendo CDN ${cdn.name}...`)

        try {

            const response = await fetch(`/cdn/${cdn.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status == 204) {
                showToastSuccess(`CDN ${cdn.name} eliminada con exito!`)
                return
            }

            const data = await response.json();
            if (data.message) {
                showToastError(data.message);
                return
            }

        } catch (err) {
            showToastError(`Error al eliminar CDN ${cdn.name}!`)
        }

        render()
    }))

    cdnList.register(new Observer('update', async cdn => {
        render()

        //showToastInfo(`Atualizando categoria ${cdn.name}...`)

        const response = await fetch(`/cdn/${cdn.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cdn)
        });

        const csrfTokenRefresh = getCsrfTokenRefresh(response);
        if (csrfTokenRefresh) csrfToken = csrfTokenRefresh;

        const data = await response.json();

        if (data.status == 200) {
            showToastSuccess(`CDN ${cdn.name} actualizada con exito!`)
            return;
        }

        showToastError(`Error al actualizar CDN ${cdn.name}!`)
    }))

    const btnAdd = new ButtonAdd()
    btnAdd.setOnClick(() => {
        const cdn = new Cdn(null, '', '', 'ACTIVE', 1)
        const form = new CdnForm(cdn)
        const modal = new CdnModal(form)

        modal.setOnSave(() => {
            if (!form.validate()) return
            cdnList.add(cdn)
            modal.hide()
        })

        modal.show()
    });

    render()
}

main()
