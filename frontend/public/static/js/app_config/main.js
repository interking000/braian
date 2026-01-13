// DTunnel/frontend/public/static/js/app_config/main.js

import { InternalError } from "../common/errors.js";
import { AppConfigAdvancedViewFooter, AppConfigViewFooter } from "./components/footer.js";
import {
  Column,
  InputBoolean,
  InputHtml,
  InputImage,
  InputSelect,
  InputString,
  InputText,
  InputUrl
} from "./components/form.js";

import Pagination from "../common/pagination.js";

import AppCustomModal from "./modals/custom.js";
import AppConfigExportModal from "./modals/export.js";
import AppConfigImportModal from "./modals/import.js";
import UpdateModal from "./modals/update.js";
// ✅ NO usar ApkDownloadModal acá. El modal APK lo maneja tu HTML inline.
// import ApkDownloadModal from "./modals/apkDownload.js";

import AppConfig from "./models.js";
import { AppConfigAdvancedView } from "./components/app.js";
import AppConfigView from "./components/app.js";
import DialogMenuImpl from "./dialog/menu.js";
import DialogPicker from "./components/core/dialogPicker.js";
import CodeEditorModal from "./modals/code.js";
import { ComponentStyled } from "./components/core/base.js";

/**
 * ✅ FIX:
 * - NO usa CardDefault (ni lo importa)
 * - NO renderiza ninguna card extra abajo
 * - Conecta botones del HTML: .__create, .__import
 * - El botón .export-config (GENERAR APK) solo se habilita acá
 *   y el HTML inline se encarga de abrir el modal (#downloadModal)
 * - Sigue cargando temas en #app
 */

class Observable {
  constructor() {
    this.observers = [];
  }

  observe(callback) {
    this.observers.push(callback);
  }

  removeObserve(callback) {
    const idx = this.observers.indexOf(callback);
    if (idx >= 0) this.observers.splice(idx, 1);
  }

  notify(event, data) {
    this.observers.forEach(cb => cb(event, data));
  }
}

class AppConfigList extends Observable {
  constructor() {
    super();
    this.items = []; // Array<AppConfig>
  }

  add(item) {
    this.items.push(item);
  }

  get(id) {
    return this.items.find(item => item.id === id);
  }

  toggle(id) {
    const item = this.get(id);
    if (!item) return;

    const index = this.items.indexOf(item);
    if (index < 0) return;

    const item2 = this.items[0];
    if (!item2) return;

    item2.id = item.id;

    this.items[0] = item;
    this.items[index] = item2;

    delete item.id;
    this.notify("toggle", item2.id);
  }

  remove(id) {
    const item = this.get(id);
    if (!item) return;

    const index = this.items.indexOf(item);
    if (index < 0) return;

    this.items.splice(index, 1);
    this.notify("delete", item);
  }

  clear() {
    this.items = [];
    this.notify("clear");
  }
}

const createIconsFooter = (config, list) => {
  const footer = new AppConfigViewFooter({
    toggle: config.id,
    delete: config.id,
    code: config.app_layout_webview != null
  });

  const updateModal = new UpdateModal(createInputApp(config));
  updateModal.setOnClickSave(() => list.notify("update", config));
  updateModal.setOnClickCancel(() => updateModal.hide());
  footer.setOnClickEdit(() => updateModal.show());

  const code = CodeEditorModal.create(config.get("APP_LAYOUT_WEBVIEW"));
  footer.setOnClickCode(() => {
    if (config.app_layout_webview) code.show();
  });

  footer.setOnClickToggle(() => list.toggle(config.id));
  footer.setOnClickDelete(() => showAlertConfirm(() => list.remove(config.id)));

  const appConfigView = new AppConfigView(config, {
    maxWidth: "270px",
    height: "400px",
    padding: "0 15px"
  });

  const appConfigExportModal = new AppConfigExportModal(config, appConfigView);
  footer.setOnClickExport(() => appConfigExportModal.show());

  const appCustomModal = new AppCustomModal();
  const appAdvancedView = new AppConfigAdvancedView(config);
  const customFooter = new AppConfigAdvancedViewFooter(
    config.get("APP_BACKGROUND_TYPE").value.selected
  );

  customFooter.setOnClickMinimize(() => appCustomModal.hide());
  customFooter.setOnClickToggleBackground(type => {
    config.app_background_type.selected = type;
    config.notify();
  });

  customFooter.setOnClickSave(() => list.notify("update", config));

  customFooter.setOnMenuClick(() => {
    const dialogMenu = new DialogMenuImpl(config);

    const dialogConfig = dialogMenu.dialogConfig;
    const dialogDefault = dialogMenu.dialogDefault;
    const dialogLogger = dialogMenu.dialogLogger;

    dialogConfig.setStyle({ background: config.app_card_config_color });
    dialogConfig.setOnClickListener(() => {
      const picker = new DialogPicker(appAdvancedView.element, null);
      picker.setOnColorChange(color => {
        dialogConfig.setStyle({ background: color });
        config.app_card_config_color = color;
      });
      picker.setColor(config.app_card_config_color);
      picker.render();
    });

    dialogDefault.setStyle({ background: config.app_dialog_background_color });
    dialogDefault.dialogHeader.closeButtonIcon.style.color = config.app_icon_color;
    dialogDefault.setOnClickListener(() => {
      const picker = new DialogPicker(appAdvancedView.element, null);
      picker.setOnColorChange(color => {
        dialogDefault.setStyle({ background: color });
        config.app_dialog_background_color = color;
      });
      picker.setColor(config.app_dialog_background_color);
      picker.render();
    });

    dialogLogger.setStyle({ background: config.app_dialog_logger_color });
    dialogLogger.dialogHeader.closeButtonIcon.style.color = config.app_icon_color;
    dialogLogger.setOnClickListener(() => {
      const picker = new DialogPicker(appAdvancedView.element, null);
      picker.setOnColorChange(color => {
        dialogLogger.setStyle({ background: color });
        config.app_dialog_logger_color = color;
      });
      picker.setColor(config.app_dialog_logger_color);
      picker.render();
    });

    dialogMenu.render();
  });

  appCustomModal.setApp(appAdvancedView);
  appCustomModal.setFooter(customFooter);
  footer.setOnClickPhone(() => appCustomModal.show());

  return footer;
};

const createInputApp = (config) => {
  const columns = [];
  const factory = {
    STRING: item => {
      const input = new InputString(item);
      input.setOnChange(value => {
        item.value = value;
        config.notify();
      });
      return input;
    },
    TEXT: item => {
      const input = new InputText(item);
      input.setOnChange(value => {
        item.value = value;
        config.notify();
      });
      return input;
    },
    IMAGE: item => {
      const input = new InputImage(item);
      input.setOnChange(value => {
        item.value = value;
        config.notify();
      });
      return input;
    },
    BOOLEAN: item => {
      const input = new InputBoolean(item);

      if (item.name === "APP_LAYOUT_WEBVIEW_ENABLED") {
        input.setValidator(value => {
          if (!config.app_layout_webview && value) {
            throw new Error(
              "LAYOUT WEBVIEW No puede estar vacio! pegue o exporte su texto luego active."
            );
          }
        });
      }

      input.setOnChange(value => {
        item.value = value;
        config.notify();
      });

      return input;
    },
    SELECT: item => {
      const input = new InputSelect(item);
      input.setOnChange(value => {
        item.value.selected = value;
        config.notify();
      });
      return input;
    },
    URL: item => {
      const input = new InputUrl(item);
      input.setOnChange(value => {
        item.value = value;
        config.notify();
      });
      return input;
    },
    HTML: item => {
      const input = new InputHtml(item);
      input.setOnChange(value => {
        item.value = value;
        config.notify();
      });
      return input;
    }
  };

  config.items.forEach(item => {
    const func = factory[item.type];
    if (!func) return;
    columns.push(new Column(func(item)));
  });

  return columns;
};

// ✅ Render SOLO los temas (NO card extra)
const renderApp = (appConfigList) => {
  const root = document.querySelector("#app") || document.querySelector(".row");
  if (!root) return;

  root.innerHTML = "";

  if (appConfigList.items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "text-center opacity-75 py-5";
    empty.innerHTML = `
      <div class="mb-2" style="font-size:18px;">No hay temas todavía</div>
      <div style="font-size:13px;">Usá <b>NUEVO</b> o <b>IMPORTAR</b> arriba.</div>
    `;
    root.appendChild(empty);
    return;
  }

  appConfigList.items.forEach(item => {
    const app = new AppConfigView(item, {
      maxWidth: "270px",
      height: "400px",
      padding: "0 15px"
    });

    const footer = createIconsFooter(item, appConfigList);
    footer.setStyle({
      display: "flex",
      justifyContent: "space-between",
      background: "#ffffff29",
      width: "100%",
      padding: "2px",
      borderRadius: "50px"
    });

    const container = new ComponentStyled(document.createElement("div"), {
      display: "flex",
      flexDirection: "column",
      width: "270px",
      height: "450px",
      alignItems: "center",
      gap: "5px"
    });

    container.append(app);
    container.append(footer);
    root.appendChild(container.element);
  });
};

const closeLoading = () => {
  const loading = document.querySelector("#loading");
  if (!loading) return;
  loading.classList.remove("d-flex");
  loading.classList.add("d-none");
};

const showLoading = () => {
  const loading = document.querySelector("#loading");
  if (!loading) return;
  loading.classList.remove("d-none");
  loading.classList.add("d-flex");
};

let csrfToken = getCsrfTokenHead();

// ✅ Bind de botones del HTML (una sola vez)
let topButtonsBound = false;

const bindTopButtons = (appConfigList) => {
  if (topButtonsBound) return;

  const btnCreate = document.querySelector(".__create");
  const btnImport = document.querySelector(".__import");
  const btnApk = document.querySelector(".export-config");

  // CREATE
  if (btnCreate) {
    btnCreate.addEventListener("click", () => appConfigList.notify("create", null));
  }

  // IMPORT
  const importModal = new AppConfigImportModal();
  if (btnImport) {
    btnImport.addEventListener("click", () => importModal.show());
  }
  importModal.setCallbackOnImport(data => {
    const config = AppConfig.fromJson({ app_config: data, id: null });
    appConfigList.add(config);
    appConfigList.notify("import", config);
    importModal.modal.hide();
  });

  // ✅ APK: SOLO habilitar. El HTML inline abre el modal.
  if (btnApk) {
    btnApk.removeAttribute("disabled");
    // NO addEventListener acá
  }

  topButtonsBound = true;
};

const main = async () => {
  const pagination = new Pagination();
  const appConfigList = new AppConfigList();

  bindTopButtons(appConfigList);

  const getConfigApp = async () => {
    appConfigList.clear();

    const offset = pagination.offset;
    const limit = pagination.limit;

    try {
      const response = await fetch(`/app_layout/list?offset=${offset}&limit=${limit}`, {
        headers: {}
      });

      const csrfTokenRefresh = getCsrfTokenRefresh(response);
      if (csrfTokenRefresh) csrfToken = csrfTokenRefresh;

      const data = await response.json();
      const items = data.data?.result || data.data || [];

      pagination.offset = data.data?.offset || 1;
      pagination.limit = data.data?.limit || 25;
      pagination.total = data.data?.total || items.length;
      pagination.render();

      items.forEach(item => appConfigList.add(AppConfig.fromJson(item)));
      renderApp(appConfigList);
      closeLoading();
    } catch (e) {
      const error = new InternalError(document.querySelector(".content"));
      error.render();
      return;
    }
  };

  await getConfigApp();

  pagination.root = document.querySelector(".content");
  pagination.mount();
  pagination.setOnPageChange(() => {
    showLoading();
    getConfigApp();
  });

  appConfigList.observe(() => {
    renderApp(appConfigList);
  });

  appConfigList.observe(async (event, config) => {
    if (event === "update") {
      const data = config.toJson();

      const response = await fetch("/app_layout/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: data
      });

      if (response.status === 200) {
        showToastSuccess("Configuracion guardada con exito!");
        return;
      }

      const result = await response.json();
      if (result.message) {
        showToastError(result.message);
        return;
      }

      showToastError("Error al guardar configuración!");
    }
  });

  appConfigList.observe(async (event, config) => {
    if (event === "delete") {
      const response = await fetch(`/app_layout/delete/${config.id}`, {
        method: "DELETE",
        headers: {}
      });

      if (response.status === 204) {
        showToastSuccess("Configuracion eliminada con exito!");
        main();
        return;
      }

      const result = await response.json();
      if (result.message) {
        showToastError(result.message);
        return;
      }

      showToastError("Error al eliminar configuración!");
    }
  });

  appConfigList.observe(async (event) => {
    if (event === "create") {
      const response = await fetch("/app_layout/create", {
        method: "POST",
        headers: {}
      });

      if (response.status === 201) {
        showToastSuccess("Layout creado con exito!");
        main();
        return;
      }

      const result = await response.json();
      if (result.message) {
        showToastError(result.message);
        return;
      }

      showToastError("Error al crear layout!");
    }
  });

  appConfigList.observe(async (event, id) => {
    if (event === "toggle") {
      const response = await fetch(`/app_layout/toogle/${id}`, {
        method: "PUT",
        headers: {}
      });

      if (response.status === 200) {
        showToastSuccess("Configuracion cambiada con exito!");
        main();
        return;
      }

      const result = await response.json();
      if (result.message) {
        showToastError(result.message);
        return;
      }

      showToastError("Error al cambiar configuración!");
    }
  });

  appConfigList.observe(async (event, config) => {
    if (event === "import") {
      const data = config.toJson();

      const response = await fetch("/app_layout/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: data
      });

      main();

      if (response.status === 201) {
        showToastSuccess("Configuracion importada con exito!");
        return;
      }

      const result = await response.json();
      if (result.error) {
        showToastSuccess(result.message);
        return;
      }

      showToastError("Error al importar configuracion!");
    }
  });

  appConfigList.observe(async (event) => {
    if (event === "sync") {
      let response = await fetch("/app_config/sync", { method: "POST" });
      let result = await response.json();
      if (result.data && result.status !== 201) {
        showToastError("Error al sincronizar configuración al padron!");
        return;
      }

      response = await fetch("/app_config/store/sync", { method: "POST" });
      result = await response.json();
      if (result.data && result.status !== 201) {
        showToastError("Error al sincronizar lista de configuraciones!");
        return;
      }

      showToastSuccess("Felicidades, configuración sincronizada con exito!");
      showLoading();
      getConfigApp();
    }
  });
};

main();
