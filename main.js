"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ImageDitherPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var PRESETS = [
  {
    id: "blue-noise",
    label: "Blue Noise",
    hint: "organic grain",
    algorithm: "blue-noise",
    threshold: 128,
    spread: 20,
    brightness: 0,
    contrast: 0,
    resizePercent: 100
  },
  {
    id: "natural-dither",
    label: "Natural Dither",
    hint: "error diffusion",
    algorithm: "floyd-steinberg",
    threshold: 128,
    spread: 30,
    brightness: 0,
    contrast: 0,
    resizePercent: 100
  },
  {
    id: "high-contrast",
    label: "High Contrast",
    hint: "bold black/white",
    algorithm: "threshold",
    threshold: 140,
    spread: 70,
    brightness: 0,
    contrast: 0,
    resizePercent: 100
  },
  {
    id: "grayscale",
    label: "Grayscale",
    hint: "no dithering",
    algorithm: "grayscale",
    threshold: 128,
    spread: 0,
    brightness: 0,
    contrast: 0,
    resizePercent: 100
  }
];
var AUTO_PRESET_OPTION = "__auto_max_compression__";
var DEFAULT_SETTINGS = {
  enabled: true,
  totalBytesSaved: 0,
  ditherFilenameTemplate: "{original}-dither",
  defaultPresetName: "natural-dither",
  defaultResizeWidthPx: 700,
  customPresets: []
};
var ImageDitherPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.modalOpen = false;
    this.settings = DEFAULT_SETTINGS;
    this.ribbonIconEl = null;
  }
  async onload() {
    await this.loadSettings();
    this.settingsTab = new ImageDitherSettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);
    this.ribbonIconEl = this.addRibbonIcon("image", "Toggle", async () => {
      await this.setEnabled(!this.settings.enabled);
      new import_obsidian.Notice(
        `Image dithering on paste/drop ${this.settings.enabled ? "enabled" : "disabled"}`
      );
    });
    this.updateRibbonState();
    this.addCommand({
      id: "enable",
      name: "Enable",
      callback: async () => {
        await this.setEnabled(true);
        new import_obsidian.Notice("Image Dither enabled");
      }
    });
    this.addCommand({
      id: "disable",
      name: "Disable",
      callback: async () => {
        await this.setEnabled(false);
        new import_obsidian.Notice("Image Dither disabled");
      }
    });
    this.registerEvent(
      this.app.workspace.on(
        "editor-paste",
        (evt, _editor, info) => {
          if (!this.settings.enabled || this.modalOpen) return;
          const file = this.extractImageFromPaste(evt);
          if (!file) return;
          const view = info instanceof import_obsidian.MarkdownView ? info : this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
          if (!view) return;
          blockEvent(evt);
          this.openDitherModal(file, view);
        }
      )
    );
    this.registerEvent(
      this.app.workspace.on(
        "editor-drop",
        (evt, _editor, info) => {
          if (!this.settings.enabled || this.modalOpen) return;
          const file = this.extractImageFromDrop(evt);
          if (!file) return;
          const view = info instanceof import_obsidian.MarkdownView ? info : this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
          if (!view) return;
          blockEvent(evt);
          this.openDitherModal(file, view);
        }
      )
    );
  }
  onunload() {
  }
  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...loaded != null ? loaded : {} };
    this.settings.defaultPresetName = normalizePresetId(
      this.settings.defaultPresetName
    );
    const width = this.settings.defaultResizeWidthPx;
    this.settings.defaultResizeWidthPx = typeof width === "number" && Number.isFinite(width) && width > 0 ? Math.round(width) : null;
    if (!Array.isArray(this.settings.customPresets)) {
      this.settings.customPresets = [];
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  getTotalBytesSaved() {
    return this.settings.totalBytesSaved;
  }
  isEnabled() {
    return this.settings.enabled;
  }
  async setEnabled(enabled) {
    var _a;
    this.settings.enabled = enabled;
    await this.saveSettings();
    this.updateRibbonState();
    (_a = this.settingsTab) == null ? void 0 : _a.refresh();
  }
  getDitherFilenameTemplate() {
    return this.settings.ditherFilenameTemplate;
  }
  async setDitherFilenameTemplate(template) {
    this.settings.ditherFilenameTemplate = template.trim() || "{original}-dither";
    await this.saveSettings();
  }
  getDefaultPresetName() {
    return this.settings.defaultPresetName;
  }
  async setDefaultPresetName(name) {
    const normalized = normalizePresetId(name);
    const valid = normalized === AUTO_PRESET_OPTION || [...PRESETS, ...this.settings.customPresets].some(
      (preset) => preset.id === normalized
    ) ? normalized : DEFAULT_SETTINGS.defaultPresetName;
    this.settings.defaultPresetName = valid;
    await this.saveSettings();
  }
  getDefaultResizeWidthPx() {
    return this.settings.defaultResizeWidthPx;
  }
  async setDefaultResizeWidthPx(value) {
    this.settings.defaultResizeWidthPx = value && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
    await this.saveSettings();
  }
  async addToBytesSaved(bytes) {
    var _a;
    this.settings.totalBytesSaved += Math.max(0, Math.round(bytes));
    await this.saveSettings();
    (_a = this.settingsTab) == null ? void 0 : _a.refresh();
  }
  getCustomPresets() {
    return this.settings.customPresets;
  }
  async addCustomPreset(preset) {
    var _a;
    this.settings.customPresets.push(preset);
    await this.saveSettings();
    (_a = this.settingsTab) == null ? void 0 : _a.refresh();
  }
  async deleteCustomPreset(id) {
    var _a;
    this.settings.customPresets = this.settings.customPresets.filter(
      (p) => p.id !== id
    );
    if (this.settings.defaultPresetName === id) {
      this.settings.defaultPresetName = DEFAULT_SETTINGS.defaultPresetName;
    }
    await this.saveSettings();
    (_a = this.settingsTab) == null ? void 0 : _a.refresh();
  }
  updateRibbonState() {
    if (!this.ribbonIconEl) return;
    this.ribbonIconEl.toggleClass("is-disabled", !this.settings.enabled);
    this.ribbonIconEl.setAttribute(
      "aria-label",
      `Image Dither: ${this.settings.enabled ? "enabled" : "disabled"}`
    );
  }
  extractImageFromPaste(evt) {
    var _a;
    if (!evt.clipboardData) return null;
    const imageItem = Array.from(evt.clipboardData.items).find(
      (item) => item.type.startsWith("image/")
    );
    return (_a = imageItem == null ? void 0 : imageItem.getAsFile()) != null ? _a : null;
  }
  extractImageFromDrop(evt) {
    var _a;
    if (!evt.dataTransfer || evt.dataTransfer.files.length === 0) return null;
    return (_a = Array.from(evt.dataTransfer.files).find(
      (file) => file.type.startsWith("image/")
    )) != null ? _a : null;
  }
  openDitherModal(file, view) {
    this.modalOpen = true;
    const modal = new DitherModal(
      this.app,
      file,
      view,
      () => {
        this.modalOpen = false;
      },
      async (savedBytes) => {
        await this.addToBytesSaved(savedBytes);
      },
      async (preset) => {
        await this.addCustomPreset(preset);
      },
      this.getDitherFilenameTemplate(),
      this.getDefaultPresetName(),
      this.getDefaultResizeWidthPx(),
      this.getCustomPresets()
    );
    modal.open();
  }
};
var ImageDitherSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    this.renderStats(containerEl);
    this.renderEnabledSetting(containerEl);
    this.renderFilenameTemplateSetting(containerEl);
    this.renderDefaultPresetSetting(containerEl);
    this.renderDefaultWidthSetting(containerEl);
    this.renderCustomPresetsSetting(containerEl);
  }
  refresh() {
    this.display();
  }
  renderStats(containerEl) {
    const totalBytes = this.plugin.getTotalBytesSaved();
    const statsSection = containerEl.createDiv({ cls: "image-dither-stats" });
    if (totalBytes > 0) {
      const bytesLabel = formatBytes(totalBytes);
      const totalLine = statsSection.createEl("p");
      totalLine.appendText("You've saved ");
      totalLine.createSpan({
        cls: "image-dither-saved-amount",
        text: bytesLabel
      });
      totalLine.appendText(" so far using Image Dither.");
      const dynamicMessage = getSavingsAllegory(totalBytes);
      statsSection.createEl("p", {
        cls: "image-dither-dynamic-message",
        text: dynamicMessage
      });
    }
  }
  renderFilenameTemplateSetting(containerEl) {
    new import_obsidian.Setting(containerEl).setName("Dithered filename template").setDesc(
      "Controls default dithered filename. Tokens: {original}, {algo}, {resize}, {timestamp}"
    ).addText(
      (text) => text.setPlaceholder("{original}-dither").setValue(this.plugin.getDitherFilenameTemplate()).onChange((value) => {
        void this.plugin.setDitherFilenameTemplate(value);
      })
    );
  }
  renderEnabledSetting(containerEl) {
    new import_obsidian.Setting(containerEl).setName("Enabled").setDesc("Turn image paste/drop interception on or off.").addToggle(
      (toggle) => toggle.setValue(this.plugin.isEnabled()).onChange((value) => {
        void this.plugin.setEnabled(value);
      })
    );
  }
  renderDefaultPresetSetting(containerEl) {
    new import_obsidian.Setting(containerEl).setName("Default preset").setDesc(
      "Preset to apply when opening the dither modal. Auto tries all presets and picks max compression."
    ).addDropdown((dropdown) => {
      dropdown.addOption(AUTO_PRESET_OPTION, "Auto (max compression)");
      PRESETS.forEach((preset) => {
        dropdown.addOption(preset.id, getPresetDisplayLabel(preset));
      });
      const customPresets = this.plugin.getCustomPresets();
      if (customPresets.length > 0) {
        const sep = dropdown.selectEl.createEl("option", {
          text: "\u2500\u2500 Custom \u2500\u2500"
        });
        sep.disabled = true;
        customPresets.forEach((preset) => {
          dropdown.addOption(preset.id, getPresetDisplayLabel(preset));
        });
      }
      dropdown.setValue(this.plugin.getDefaultPresetName());
      dropdown.onChange((value) => {
        void this.plugin.setDefaultPresetName(value);
      });
    });
  }
  renderDefaultWidthSetting(containerEl) {
    new import_obsidian.Setting(containerEl).setName("Default output width (approximate px)").setDesc(
      "If set, resize defaults to the closest percentage for each image. Remove to default to original image width"
    ).addText((text) => {
      text.setPlaceholder("Optional").setValue(
        this.plugin.getDefaultResizeWidthPx() !== null ? String(this.plugin.getDefaultResizeWidthPx()) : ""
      ).onChange((value) => {
        const parsed = Number(value.trim());
        if (value.trim() === "" || !Number.isFinite(parsed) || parsed <= 0) {
          void this.plugin.setDefaultResizeWidthPx(null);
          return;
        }
        void this.plugin.setDefaultResizeWidthPx(parsed);
      });
      text.inputEl.type = "number";
      text.inputEl.inputMode = "numeric";
      text.inputEl.min = "1";
      text.inputEl.step = "1";
    });
  }
  renderCustomPresetsSetting(containerEl) {
    const customPresets = this.plugin.getCustomPresets();
    if (customPresets.length === 0) return;
    containerEl.createEl("h3", {
      text: "Custom presets",
      cls: "dither-settings-section-heading"
    });
    customPresets.forEach((preset) => {
      new import_obsidian.Setting(containerEl).setName(preset.label).setDesc(
        `${preset.algorithm} \xB7 threshold ${preset.threshold} \xB7 sharpness ${preset.spread}% \xB7 resize ${preset.resizePercent}%`
      ).addButton((btn) => {
        btn.setButtonText("Delete").setWarning().onClick(() => {
          new ConfirmModal(
            this.plugin.app,
            `Delete preset "${preset.label}"?`,
            "This cannot be undone.",
            () => void this.plugin.deleteCustomPreset(preset.id)
          ).open();
        });
      });
    });
  }
};
var DitherModal = class extends import_obsidian.Modal {
  constructor(app, file, view, onClose, onDitherSaved, onSavePreset, filenameTemplate, defaultPresetName, defaultResizeWidthPx, customPresets) {
    super(app);
    this.ditherNameBase = "";
    this.lastAutoDitherNameBase = "";
    this.isDitherNameAuto = true;
    this.customPresets = [];
    this.algorithm = "floyd-steinberg";
    this.threshold = 128;
    this.spread = 30;
    this.brightness = 0;
    this.contrast = 0;
    this.resizePercent = 100;
    this.invertColors = false;
    this.originalBytes = 0;
    this.originalPreviewUrl = null;
    this.previewUpdateTimer = null;
    this.file = file;
    this.view = view;
    this.onCloseCallback = onClose;
    this.onDitherSaved = onDitherSaved;
    this.onSavePreset = onSavePreset;
    this.filenameTemplate = filenameTemplate;
    this.defaultPresetName = defaultPresetName;
    this.defaultResizeWidthPx = defaultResizeWidthPx;
    this.customPresets = [...customPresets];
    this.canvas = document.createElement("canvas");
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Failed to create canvas context");
    this.ctx = ctx;
  }
  onOpen() {
    if (this.defaultPresetName !== AUTO_PRESET_OPTION) {
      this.applyPresetByName(this.defaultPresetName);
    } else {
      this.applyPresetByName(DEFAULT_SETTINGS.defaultPresetName);
    }
    this.modalEl.addClass("dither-modal-container");
    this.contentEl.addClass("dither-modal");
    if (this.modalEl.parentElement) {
      this.modalEl.parentElement.classList.add("dither-modal-overlay");
    }
    this.titleEl.setText("Dither image before saving");
    const previewCol = this.contentEl.createDiv({ cls: "dither-preview-col" });
    const previewGrid = previewCol.createDiv({ cls: "dither-preview-grid" });
    const beforeCard = previewGrid.createDiv({ cls: "dither-preview-card" });
    beforeCard.createDiv({ cls: "dither-preview-label", text: "Original" });
    const beforeFrame = beforeCard.createDiv({ cls: "dither-preview" });
    this.previewBeforeImg = beforeFrame.createEl("img", {
      attr: { alt: "Original preview" }
    });
    this.previewBeforeInfo = beforeCard.createDiv({
      cls: "dither-preview-meta"
    });
    this.previewBeforeName = beforeCard.createDiv({
      cls: "dither-preview-name"
    });
    const afterCard = previewGrid.createDiv({ cls: "dither-preview-card" });
    afterCard.createDiv({ cls: "dither-preview-label", text: "Dithered" });
    const afterFrame = afterCard.createDiv({ cls: "dither-preview" });
    this.previewAfterImg = afterFrame.createEl("img", {
      attr: { alt: "Dithered preview" }
    });
    this.previewAfterInfo = afterCard.createDiv({ cls: "dither-preview-meta" });
    const afterNameRow = afterCard.createDiv({ cls: "dither-filename-row" });
    this.ditherNameInput = afterNameRow.createEl("input", {
      cls: "dither-filename-input",
      attr: { type: "text", spellcheck: "false", placeholder: "Filename" }
    });
    afterNameRow.createDiv({ cls: "dither-filename-ext", text: ".png" });
    this.ditherNameInput.addEventListener("input", () => {
      var _a, _b, _c;
      const current = sanitizeFileBaseName(
        (_c = (_b = (_a = this.ditherNameInput) == null ? void 0 : _a.value) == null ? void 0 : _b.trim()) != null ? _c : ""
      );
      this.isDitherNameAuto = current === this.lastAutoDitherNameBase;
    });
    void this.applyTemplateDefaultDitherName();
    this.previewSavings = previewCol.createDiv({ cls: "dither-savings" });
    const controlsWrap = this.contentEl.createDiv({
      cls: "dither-controls-wrap"
    });
    const controls = controlsWrap.createDiv();
    controls.addClass("dither-controls");
    const algorithmRow = controls.createDiv({ cls: "dither-row" });
    algorithmRow.createEl("label", { text: "Algorithm" });
    const algorithmSelect = algorithmRow.createEl("select");
    [
      { value: "floyd-steinberg", label: "Floyd-Steinberg" },
      { value: "blue-noise", label: "Blue Noise" },
      { value: "ordered", label: "Ordered (Bayer)" },
      { value: "threshold", label: "Threshold" },
      { value: "grayscale", label: "Grayscale" }
    ].forEach((opt) => {
      algorithmSelect.createEl("option", { value: opt.value, text: opt.label });
    });
    algorithmSelect.value = this.algorithm;
    this.algorithmSelectEl = algorithmSelect;
    const thresholdRow = controls.createDiv({ cls: "dither-row" });
    thresholdRow.createEl("label", { text: "Threshold" });
    const thresholdInput = thresholdRow.createEl("input", {
      attr: {
        type: "range",
        min: "0",
        max: "255",
        value: String(this.threshold)
      }
    });
    const thresholdValue = thresholdRow.createDiv({
      cls: "dither-value",
      text: String(this.threshold)
    });
    this.thresholdInputEl = thresholdInput;
    this.thresholdValueEl = thresholdValue;
    const spreadRow = controls.createDiv({ cls: "dither-row" });
    spreadRow.createEl("label", { text: "Sharpness" });
    const spreadInput = spreadRow.createEl("input", {
      attr: { type: "range", min: "0", max: "100", value: String(this.spread) }
    });
    const spreadValue = spreadRow.createDiv({
      cls: "dither-value",
      text: `${this.spread}%`
    });
    this.spreadInputEl = spreadInput;
    this.spreadValueEl = spreadValue;
    const brightnessRow = controls.createDiv({ cls: "dither-row" });
    brightnessRow.createEl("label", { text: "Brightness" });
    const brightnessInput = brightnessRow.createEl("input", {
      attr: {
        type: "range",
        min: "-100",
        max: "100",
        value: String(this.brightness)
      }
    });
    const brightnessValue = brightnessRow.createDiv({
      cls: "dither-value",
      text: `${this.brightness}%`
    });
    this.brightnessInputEl = brightnessInput;
    this.brightnessValueEl = brightnessValue;
    const contrastRow = controls.createDiv({ cls: "dither-row" });
    contrastRow.createEl("label", { text: "Contrast" });
    const contrastInput = contrastRow.createEl("input", {
      attr: {
        type: "range",
        min: "-100",
        max: "100",
        value: String(this.contrast)
      }
    });
    const contrastValue = contrastRow.createDiv({
      cls: "dither-value",
      text: `${this.contrast}%`
    });
    this.contrastInputEl = contrastInput;
    this.contrastValueEl = contrastValue;
    const resizeRow = controls.createDiv({ cls: "dither-row" });
    resizeRow.createEl("label", { text: "Resize (%)" });
    const resizeInput = resizeRow.createEl("input", {
      attr: {
        type: "range",
        min: "10",
        max: "100",
        value: String(this.resizePercent)
      }
    });
    const resizeValue = resizeRow.createDiv({
      cls: "dither-value",
      text: `${this.resizePercent}%`
    });
    this.resizeInputEl = resizeInput;
    this.resizeValueEl = resizeValue;
    this.updateResizeValueLabel();
    const presetRow = controls.createDiv({
      cls: "dither-row dither-row-preset"
    });
    presetRow.createEl("label", { text: "Preset" });
    const presetSelect = presetRow.createEl("select");
    presetSelect.createEl("option", {
      value: AUTO_PRESET_OPTION,
      text: "Auto (max compression)"
    });
    PRESETS.forEach((preset) => {
      presetSelect.createEl("option", {
        value: preset.id,
        text: getPresetDisplayLabel(preset)
      });
    });
    if (this.customPresets.length > 0) {
      const customSep = presetSelect.createEl("option", {
        text: "\u2500\u2500 Custom \u2500\u2500"
      });
      customSep.disabled = true;
      this.customPresets.forEach((preset) => {
        presetSelect.createEl("option", {
          value: preset.id,
          text: getPresetDisplayLabel(preset)
        });
      });
    }
    presetSelect.value = this.defaultPresetName === AUTO_PRESET_OPTION ? AUTO_PRESET_OPTION : this.defaultPresetName;
    this.presetSelectEl = presetSelect;
    const invertRow = controls.createDiv({ cls: "dither-row" });
    invertRow.createEl("label", { text: "Invert colors" });
    const invertToggle = invertRow.createEl("input", {
      attr: { type: "checkbox" }
    });
    invertToggle.checked = this.invertColors;
    invertRow.createDiv({ cls: "dither-value", text: "" });
    const actions = controls.createDiv({ cls: "dither-actions" });
    const savePresetBtn = actions.createEl("button", {
      text: "Save current as preset"
    });
    savePresetBtn.addClass("dither-save-preset-btn");
    const actionsRight = actions.createDiv({
      cls: "dither-actions-right-group"
    });
    const cancelBtn = actionsRight.createEl("button", { text: "Cancel" });
    const useOriginalBtn = actionsRight.createEl("button", {
      text: "Use original"
    });
    const saveBtn = actionsRight.createEl("button", { text: "Use dithered" });
    saveBtn.addClass("mod-cta");
    this.useDitheredBtn = saveBtn;
    this.useOriginalBtn = useOriginalBtn;
    algorithmSelect.addEventListener("change", () => {
      this.algorithm = algorithmSelect.value;
      void this.maybeRefreshTemplatedFilename();
      this.queuePreviewUpdate();
    });
    thresholdInput.addEventListener("input", () => {
      this.threshold = Number(thresholdInput.value);
      thresholdValue.setText(String(this.threshold));
      this.queuePreviewUpdate();
    });
    spreadInput.addEventListener("input", () => {
      this.spread = Number(spreadInput.value);
      spreadValue.setText(`${this.spread}%`);
      this.queuePreviewUpdate();
    });
    brightnessInput.addEventListener("input", () => {
      this.brightness = Number(brightnessInput.value);
      brightnessValue.setText(`${this.brightness}%`);
      this.queuePreviewUpdate();
    });
    contrastInput.addEventListener("input", () => {
      this.contrast = Number(contrastInput.value);
      contrastValue.setText(`${this.contrast}%`);
      this.queuePreviewUpdate();
    });
    resizeInput.addEventListener("input", () => {
      this.resizePercent = Number(resizeInput.value);
      this.updateResizeValueLabel();
      void this.maybeRefreshTemplatedFilename();
      this.queuePreviewUpdate();
    });
    invertToggle.addEventListener("change", () => {
      this.invertColors = invertToggle.checked;
      this.queuePreviewUpdate();
    });
    presetSelect.addEventListener("change", () => {
      if (presetSelect.value === AUTO_PRESET_OPTION) {
        this.defaultPresetName = AUTO_PRESET_OPTION;
        void this.applyBestCompressionPreset().then(() => {
          this.syncControlsFromState();
          void this.maybeRefreshTemplatedFilename();
          this.queuePreviewUpdate();
        });
        return;
      }
      const preset = [...PRESETS, ...this.customPresets].find(
        (p) => p.id === presetSelect.value
      );
      if (!preset) return;
      this.defaultPresetName = preset.id;
      this.applyPresetByName(preset.id);
      this.applyDefaultResizeWidthIfConfigured();
      this.syncControlsFromState();
      void this.maybeRefreshTemplatedFilename();
      this.queuePreviewUpdate();
    });
    cancelBtn.addEventListener("click", () => this.close());
    savePresetBtn.addEventListener("click", () => {
      const existingLabels = [...PRESETS, ...this.customPresets].map(
        (p) => p.label.toLowerCase()
      );
      new SavePresetModal(this.app, existingLabels, (name) => {
        const id = slugifyPresetLabel(name, [
          ...PRESETS,
          ...this.customPresets
        ]);
        const preset = {
          id,
          label: name,
          hint: "custom",
          algorithm: this.algorithm,
          threshold: this.threshold,
          spread: this.spread,
          brightness: this.brightness,
          contrast: this.contrast,
          resizePercent: this.resizePercent
        };
        void this.onSavePreset(preset).then(() => {
          this.customPresets.push(preset);
          this.defaultPresetName = preset.id;
          const hasSep = Array.from(presetSelect.options).some(
            (o) => o.text === "\u2500\u2500 Custom \u2500\u2500"
          );
          if (!hasSep) {
            const customSep = presetSelect.createEl("option", {
              text: "\u2500\u2500 Custom \u2500\u2500"
            });
            customSep.disabled = true;
          }
          presetSelect.createEl("option", {
            value: preset.id,
            text: getPresetDisplayLabel(preset)
          });
          presetSelect.value = preset.id;
          new import_obsidian.Notice(`Preset "${name}" saved`);
        });
      }).open();
    });
    useOriginalBtn.addEventListener("click", () => {
      void this.saveImage(true);
    });
    saveBtn.addEventListener("click", () => {
      void this.saveImage(false);
    });
    void this.loadOriginal();
  }
  onClose() {
    this.contentEl.empty();
    if (this.originalPreviewUrl) {
      URL.revokeObjectURL(this.originalPreviewUrl);
      this.originalPreviewUrl = null;
    }
    this.onCloseCallback();
  }
  async loadOriginal() {
    this.originalBytes = this.file.size;
    if (this.previewBeforeName) {
      this.previewBeforeName.setText(this.file.name);
    }
    if (this.useOriginalBtn) {
      this.useOriginalBtn.setText(
        `Use original (${formatBytes(this.originalBytes)})`
      );
    }
    if (this.useDitheredBtn) {
      this.useDitheredBtn.setText("Use dithered (processing...)");
    }
    this.originalPreviewUrl = URL.createObjectURL(this.file);
    if (this.previewBeforeImg) {
      this.previewBeforeImg.src = this.originalPreviewUrl;
    }
    const img = new Image();
    img.onload = async () => {
      this.originalImage = img;
      this.updateResizeValueLabel();
      if (this.defaultPresetName === AUTO_PRESET_OPTION) {
        await this.applyBestCompressionPreset();
      }
      this.applyDefaultResizeWidthIfConfigured();
      this.syncControlsFromState();
      this.queuePreviewUpdate(true);
    };
    img.src = this.originalPreviewUrl;
  }
  queuePreviewUpdate(immediate = false) {
    if (this.previewUpdateTimer) {
      window.clearTimeout(this.previewUpdateTimer);
      this.previewUpdateTimer = null;
    }
    const delay = immediate ? 0 : 50;
    this.previewUpdateTimer = window.setTimeout(() => {
      this.previewUpdateTimer = null;
      void this.updatePreview();
    }, delay);
  }
  async updatePreview() {
    if (!this.originalImage || !this.previewAfterImg || !this.previewAfterInfo || !this.previewBeforeInfo || !this.previewSavings) {
      return;
    }
    const rendered = await this.renderProcessedBlob();
    if (!rendered) return;
    const { blob, width, height } = rendered;
    this.latestPreviewBlob = blob;
    const previewUrl = URL.createObjectURL(blob);
    this.previewAfterImg.src = previewUrl;
    this.previewAfterImg.onload = () => URL.revokeObjectURL(previewUrl);
    const savedBytes = Math.max(0, this.originalBytes - blob.size);
    const savedPercent = this.originalBytes ? Math.round(
      (this.originalBytes - blob.size) / this.originalBytes * 1e3
    ) / 10 : 0;
    const largerBy = blob.size - this.originalBytes;
    const isDanger = savedPercent <= 0;
    const isWarn = savedPercent > 0 && savedPercent <= 10;
    this.previewBeforeInfo.setText(
      `${formatBytes(this.originalBytes)}
${this.originalImage.naturalWidth} x ${this.originalImage.naturalHeight} px`
    );
    this.previewAfterInfo.setText(
      `${formatBytes(blob.size)}
${width} x ${height} px`
    );
    this.previewSavings.empty();
    this.previewSavings.createSpan({
      cls: "dither-size-flow-inline",
      text: `${formatBytes(this.originalBytes)} \u2192 ${formatBytes(blob.size)}`
    });
    this.previewSavings.createSpan({
      cls: `dither-savings-value ${isDanger ? "is-danger" : isWarn ? "is-warn" : "is-good"}`,
      text: isDanger ? `Saved: ${savedPercent}% (larger by ${formatBytes(Math.max(0, largerBy))})` : `Saved: ${savedPercent}% (-${formatBytes(savedBytes)})`
    });
    if (this.useDitheredBtn) {
      const label = isDanger ? `Use dithered (+${Math.abs(savedPercent)}%, ${formatBytes(blob.size)})` : `Use dithered (-${savedPercent}%, ${formatBytes(blob.size)})`;
      this.useDitheredBtn.setText(label);
    }
  }
  getTargetSize(originalWidth, originalHeight) {
    const scale = this.resizePercent / 100;
    const targetWidth = Math.max(1, Math.round(originalWidth * scale));
    const targetHeight = Math.max(1, Math.round(originalHeight * scale));
    return { width: targetWidth, height: targetHeight };
  }
  applyPresetByName(name) {
    const preset = [...PRESETS, ...this.customPresets].find(
      (p) => p.id === name
    );
    if (!preset) return;
    this.algorithm = preset.algorithm;
    this.threshold = preset.threshold;
    this.spread = preset.spread;
    this.brightness = preset.brightness;
    this.contrast = preset.contrast;
    this.resizePercent = preset.resizePercent;
  }
  getActivePresetName() {
    var _a;
    const match = [...PRESETS, ...this.customPresets].find(
      (preset) => preset.algorithm === this.algorithm && preset.threshold === this.threshold && preset.spread === this.spread && preset.brightness === this.brightness && preset.contrast === this.contrast && preset.resizePercent === this.resizePercent
    );
    return (_a = match == null ? void 0 : match.id) != null ? _a : DEFAULT_SETTINGS.defaultPresetName;
  }
  syncControlsFromState() {
    if (this.algorithmSelectEl) this.algorithmSelectEl.value = this.algorithm;
    if (this.thresholdInputEl)
      this.thresholdInputEl.value = String(this.threshold);
    if (this.thresholdValueEl)
      this.thresholdValueEl.setText(String(this.threshold));
    if (this.spreadInputEl) this.spreadInputEl.value = String(this.spread);
    if (this.spreadValueEl) this.spreadValueEl.setText(`${this.spread}%`);
    if (this.brightnessInputEl)
      this.brightnessInputEl.value = String(this.brightness);
    if (this.brightnessValueEl)
      this.brightnessValueEl.setText(`${this.brightness}%`);
    if (this.contrastInputEl)
      this.contrastInputEl.value = String(this.contrast);
    if (this.contrastValueEl) this.contrastValueEl.setText(`${this.contrast}%`);
    if (this.resizeInputEl)
      this.resizeInputEl.value = String(this.resizePercent);
    if (this.presetSelectEl) {
      this.presetSelectEl.value = this.defaultPresetName === AUTO_PRESET_OPTION ? AUTO_PRESET_OPTION : this.defaultPresetName;
    }
    this.updateResizeValueLabel();
  }
  async applyBestCompressionPreset() {
    if (!this.originalImage) return;
    const snapshot = {
      algorithm: this.algorithm,
      threshold: this.threshold,
      spread: this.spread,
      brightness: this.brightness,
      contrast: this.contrast,
      resizePercent: this.resizePercent
    };
    let bestPreset = PRESETS[0];
    let bestSavedPercent = -Infinity;
    const allPresets = [...PRESETS, ...this.customPresets];
    for (const preset of allPresets) {
      this.applyPresetByName(preset.id);
      this.applyDefaultResizeWidthIfConfigured();
      const rendered = await this.renderProcessedBlob();
      if (!rendered || this.originalBytes <= 0) continue;
      const savedPercent = (this.originalBytes - rendered.blob.size) / this.originalBytes * 100;
      if (savedPercent > bestSavedPercent) {
        bestSavedPercent = savedPercent;
        bestPreset = preset;
      }
    }
    this.algorithm = snapshot.algorithm;
    this.threshold = snapshot.threshold;
    this.spread = snapshot.spread;
    this.brightness = snapshot.brightness;
    this.contrast = snapshot.contrast;
    this.resizePercent = snapshot.resizePercent;
    this.applyPresetByName(bestPreset.id);
    this.applyDefaultResizeWidthIfConfigured();
  }
  applyDefaultResizeWidthIfConfigured() {
    if (!this.originalImage) return;
    if (!this.defaultResizeWidthPx) return;
    this.resizePercent = widthToResizePercent(
      this.defaultResizeWidthPx,
      this.originalImage.naturalWidth
    );
  }
  updateResizeValueLabel() {
    if (!this.resizeValueEl) return;
    this.resizeValueEl.setText(`${this.resizePercent}%`);
  }
  async renderProcessedBlob() {
    if (!this.originalImage) return null;
    const { width, height } = this.getTargetSize(
      this.originalImage.naturalWidth,
      this.originalImage.naturalHeight
    );
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.drawImage(this.originalImage, 0, 0, width, height);
    const imageData = this.ctx.getImageData(0, 0, width, height);
    this.applyDither(imageData);
    this.ctx.putImageData(imageData, 0, 0);
    const blob = await new Promise(
      (resolve) => this.canvas.toBlob((b) => resolve(b), "image/png")
    );
    if (!blob) return null;
    return { blob, width, height };
  }
  applyDither(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const grayBase = new Float32Array(width * height);
    const brightnessOffset = this.brightness / 100 * 255;
    const contrastFactor = contrastPercentToFactor(this.contrast);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const baseGray = toGray(data[idx], data[idx + 1], data[idx + 2]) + brightnessOffset;
        const contrastGray = (baseGray - 128) * contrastFactor + 128;
        grayBase[y * width + x] = clampByte(contrastGray);
      }
    }
    applySharpness(grayBase, width, height, this.spread / 100);
    if (this.algorithm === "grayscale") {
      for (let i = 0; i < data.length; i += 4) {
        const gray = grayBase[i / 4];
        const v = this.invertColors ? 255 - gray : gray;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
      }
      return;
    }
    if (this.algorithm === "threshold") {
      for (let i = 0; i < data.length; i += 4) {
        const gray = grayBase[i / 4];
        const bw = gray > this.threshold ? 255 : 0;
        const v = this.invertColors ? 255 - bw : bw;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
      }
      return;
    }
    if (this.algorithm === "ordered") {
      const bayer = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5]
      ];
      const scale = 16;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const gray = grayBase[y * width + x];
          const threshold = bayer[y % 4][x % 4] / scale * 255;
          const bw = gray > threshold ? 255 : 0;
          const v = this.invertColors ? 255 - bw : bw;
          data[idx] = v;
          data[idx + 1] = v;
          data[idx + 2] = v;
        }
      }
      return;
    }
    if (this.algorithm === "blue-noise") {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const gray = grayBase[y * width + x];
          const t = 52.9829189 * ((0.06711056 * x + 583715e-8 * y) % 1 + 1) % 1;
          const bw = gray > t * 255 ? 255 : 0;
          const v = this.invertColors ? 255 - bw : bw;
          data[idx] = v;
          data[idx + 1] = v;
          data[idx + 2] = v;
        }
      }
      return;
    }
    const buffer = Float32Array.from(grayBase);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const oldPixel = buffer[idx];
        const newPixel = oldPixel > this.threshold ? 255 : 0;
        const error = oldPixel - newPixel;
        buffer[idx] = newPixel;
        if (x + 1 < width) buffer[idx + 1] += error * 7 / 16;
        if (x - 1 >= 0 && y + 1 < height)
          buffer[idx + width - 1] += error * 3 / 16;
        if (y + 1 < height) buffer[idx + width] += error * 5 / 16;
        if (x + 1 < width && y + 1 < height)
          buffer[idx + width + 1] += error * 1 / 16;
      }
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const bw = buffer[y * width + x] > 127 ? 255 : 0;
        const v = this.invertColors ? 255 - bw : bw;
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
      }
    }
  }
  async saveImage(useOriginal) {
    var _a;
    if (!this.originalImage) return;
    const editor = this.view.editor;
    const sourceFile = this.view.file;
    if (!sourceFile) {
      new import_obsidian.Notice("No active file to insert image into.");
      return;
    }
    try {
      let blobToSave = null;
      if (useOriginal) {
        blobToSave = this.file;
      } else {
        if (!this.latestPreviewBlob) {
          await this.updatePreview();
        }
        blobToSave = (_a = this.latestPreviewBlob) != null ? _a : null;
      }
      if (!blobToSave) {
        new import_obsidian.Notice("No image data to save.");
        return;
      }
      const arrayBuffer = await blobToSave.arrayBuffer();
      const extension = useOriginal ? getExtension(this.file.type) : "png";
      const baseName = useOriginal ? sanitizeFileBaseName(stripExtension(this.file.name)) : this.getDitherBaseName();
      const fileName = `${baseName}.${extension}`;
      const filePath = await getHyphenIncrementedAttachmentPath(
        this.app,
        fileName,
        sourceFile.path
      );
      const created = await this.app.vault.createBinary(filePath, arrayBuffer);
      const link = this.app.fileManager.generateMarkdownLink(
        created,
        sourceFile.path
      );
      const embed = link.startsWith("!") ? link : `!${link}`;
      editor.replaceRange(embed, editor.getCursor());
      if (!useOriginal) {
        const bytesSaved = this.originalBytes - blobToSave.size;
        await this.onDitherSaved(bytesSaved);
      }
      this.close();
    } catch (err) {
      console.error(err);
      new import_obsidian.Notice("Failed to save dithered image.");
    }
  }
  getDitherBaseName() {
    var _a, _b, _c;
    const fromInput = (_c = (_b = (_a = this.ditherNameInput) == null ? void 0 : _a.value) == null ? void 0 : _b.trim()) != null ? _c : "";
    const safe = sanitizeFileBaseName(
      fromInput || this.ditherNameBase || "dithered-image"
    );
    if (this.ditherNameInput) {
      this.ditherNameInput.value = safe;
    }
    return safe;
  }
  getDefaultDitherBaseName() {
    var _a;
    const originalBase = sanitizeFileBaseName(stripExtension(this.file.name));
    const template = ((_a = this.filenameTemplate) == null ? void 0 : _a.trim()) || "{original}-dither";
    const rendered = template.replaceAll("{original}", originalBase).replaceAll("{algo}", this.algorithm).replaceAll("{resize}", String(this.resizePercent)).replaceAll("{timestamp}", compactTimestamp(/* @__PURE__ */ new Date()));
    return sanitizeFileBaseName(rendered);
  }
  async applyTemplateDefaultDitherName() {
    const templatedBase = this.getDefaultDitherBaseName();
    const uniqueBase = await this.getUniqueBaseForCurrentFolder(
      templatedBase,
      "png"
    );
    this.ditherNameBase = uniqueBase;
    this.lastAutoDitherNameBase = uniqueBase;
    this.isDitherNameAuto = true;
    if (this.ditherNameInput) {
      this.ditherNameInput.value = uniqueBase;
    }
  }
  usesDynamicTemplateTokens() {
    var _a;
    const template = ((_a = this.filenameTemplate) == null ? void 0 : _a.trim()) || "{original}-dither";
    return template.includes("{algo}") || template.includes("{resize}");
  }
  async maybeRefreshTemplatedFilename() {
    if (!this.isDitherNameAuto) return;
    if (!this.usesDynamicTemplateTokens()) return;
    await this.applyTemplateDefaultDitherName();
  }
  async getUniqueBaseForCurrentFolder(baseName, extension) {
    var _a, _b;
    const sourceFile = (_a = this.view.file) != null ? _a : this.app.workspace.getActiveFile();
    if (!sourceFile) return sanitizeFileBaseName(baseName);
    const candidate = `${sanitizeFileBaseName(baseName)}.${extension}`;
    const uniquePath = await getHyphenIncrementedAttachmentPath(
      this.app,
      candidate,
      sourceFile.path
    );
    const fileName = (_b = uniquePath.split("/").pop()) != null ? _b : `${baseName}.${extension}`;
    return sanitizeFileBaseName(stripExtension(fileName));
  }
};
var ConfirmModal = class extends import_obsidian.Modal {
  constructor(app, message, detail, onConfirm) {
    super(app);
    this.message = message;
    this.detail = detail;
    this.onConfirm = onConfirm;
  }
  onOpen() {
    this.titleEl.setText(this.message);
    this.contentEl.addClass("dither-confirm-modal");
    if (this.detail) {
      this.contentEl.createEl("p", {
        text: this.detail,
        cls: "dither-confirm-detail"
      });
    }
    const actions = this.contentEl.createDiv({ cls: "dither-confirm-actions" });
    const cancelBtn = actions.createEl("button", { text: "Cancel" });
    const confirmBtn = actions.createEl("button", { text: "Delete" });
    confirmBtn.addClass("mod-warning");
    cancelBtn.addEventListener("click", () => this.close());
    confirmBtn.addEventListener("click", () => {
      this.close();
      this.onConfirm();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var SavePresetModal = class extends import_obsidian.Modal {
  constructor(app, existingLabels, onConfirm) {
    super(app);
    this.existingLabels = existingLabels;
    this.onConfirm = onConfirm;
  }
  onOpen() {
    this.titleEl.setText("Save as preset");
    this.contentEl.addClass("dither-save-preset-modal");
    const input = this.contentEl.createEl("input", {
      cls: "dither-preset-name-input",
      attr: { type: "text", placeholder: "e.g. Dark portrait" }
    });
    const errorEl = this.contentEl.createDiv({
      cls: "dither-preset-name-error"
    });
    const actions = this.contentEl.createDiv({
      cls: "dither-save-preset-actions"
    });
    const cancelBtn = actions.createEl("button", { text: "Cancel" });
    const confirmBtn = actions.createEl("button", { text: "Save" });
    confirmBtn.addClass("mod-cta");
    const validate = (value) => {
      const trimmed = value.trim();
      if (trimmed && this.existingLabels.includes(trimmed.toLowerCase())) {
        errorEl.setText(
          `"${trimmed}" already exists \u2014 choose a different name`
        );
        errorEl.addClass("is-visible");
        confirmBtn.setAttr("disabled", "");
        return false;
      }
      errorEl.setText("");
      errorEl.removeClass("is-visible");
      confirmBtn.removeAttribute("disabled");
      return true;
    };
    const save = () => {
      const trimmed = input.value.trim();
      if (!trimmed || !validate(trimmed)) return;
      this.close();
      this.onConfirm(trimmed);
    };
    input.addEventListener("input", () => validate(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") save();
      if (e.key === "Escape") this.close();
    });
    confirmBtn.addEventListener("click", save);
    cancelBtn.addEventListener("click", () => this.close());
    setTimeout(() => input.focus(), 0);
  }
  onClose() {
    this.contentEl.empty();
  }
};
function slugifyPresetLabel(label, existing) {
  const base = "custom-" + (label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "preset");
  if (!existing.some((p) => p.id === base)) return base;
  let i = 2;
  while (existing.some((p) => p.id === `${base}-${i}`)) i++;
  return `${base}-${i}`;
}
function toGray(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
function applySharpness(buffer, width, height, amount) {
  if (amount <= 0) return;
  const source = Float32Array.from(buffer);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let ky = -1; ky <= 1; ky++) {
        const sy = y + ky;
        if (sy < 0 || sy >= height) continue;
        for (let kx = -1; kx <= 1; kx++) {
          const sx = x + kx;
          if (sx < 0 || sx >= width) continue;
          sum += source[sy * width + sx];
          count++;
        }
      }
      const idx = y * width + x;
      const blur = sum / count;
      const sharp = source[idx] + (source[idx] - blur) * (amount * 2);
      buffer[idx] = clampByte(sharp);
    }
  }
}
function clampByte(value) {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return value;
}
function contrastPercentToFactor(percent) {
  const contrast = percent / 100 * 255;
  return 259 * (contrast + 255) / (255 * (259 - contrast));
}
function getPresetDisplayLabel(preset) {
  return `${preset.label} (${preset.hint})`;
}
function normalizePresetId(value) {
  const normalized = (value != null ? value : "").trim();
  if (normalized === AUTO_PRESET_OPTION) return AUTO_PRESET_OPTION;
  const oldToNew = {
    Balanced: "natural-dither",
    Small: AUTO_PRESET_OPTION,
    Sharp: "high-contrast",
    Grayscale: "grayscale",
    "max-compression": AUTO_PRESET_OPTION
  };
  if (oldToNew[normalized]) return oldToNew[normalized];
  return normalized;
}
function widthToResizePercent(targetWidthPx, originalWidthPx) {
  if (!Number.isFinite(targetWidthPx) || targetWidthPx <= 0 || originalWidthPx <= 0) {
    return 100;
  }
  const ratio = targetWidthPx / originalWidthPx;
  const percent = Math.round(ratio * 100);
  return clampInt(percent, 10, 100);
}
function clampInt(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}
function getExtension(mime) {
  var _a;
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp"
  };
  return (_a = map[mime]) != null ? _a : "png";
}
function stripExtension(fileName) {
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0) return fileName;
  return fileName.slice(0, idx);
}
function sanitizeFileBaseName(name) {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().replace(/\.+$/g, "");
  return cleaned || "image";
}
function blockEvent(evt) {
  evt.preventDefault();
  evt.stopPropagation();
  evt.stopImmediatePropagation();
  evt.returnValue = false;
}
async function getHyphenIncrementedAttachmentPath(app, filename, sourcePath) {
  const attachmentProbe = await app.fileManager.getAvailablePathForAttachment(
    "__image_dither_probe__.tmp",
    sourcePath
  );
  const slash = attachmentProbe.lastIndexOf("/");
  const folder = slash >= 0 ? attachmentProbe.slice(0, slash) : "";
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot) : "";
  const base = dot >= 0 ? filename.slice(0, dot) : filename;
  let attempt = folder ? `${folder}/${filename}` : filename;
  let counter = 1;
  while (app.vault.getAbstractFileByPath(attempt)) {
    const nextName = `${base}-${counter}${ext}`;
    attempt = folder ? `${folder}/${nextName}` : nextName;
    counter++;
  }
  return attempt;
}
function compactTimestamp(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}
function getSavingsAllegory(totalBytes) {
  const comparisons = [
    () => `That's about ${formatNumber(totalBytes / (1.44 * 1024 * 1024))} classic 1.44 MB floppy disks.`,
    () => `That's around ${formatNumber(totalBytes / (1024 * 1024))} one-minute MP3 songs at 128 kbps.`,
    () => `That's roughly ${formatNumber(totalBytes / 4e4)} NES-era game ROMs (about 40 KB each).`,
    () => `At 10 Mbps upload speed, that's about ${formatNumber(totalBytes * 8 / 1e7)} seconds of transfer time avoided.`,
    () => `That's enough room for about ${formatNumber(totalBytes / (2.5 * 1024 * 1024))} extra photos on your phone (2.5 MB each).`
  ];
  return comparisons[Math.floor(Math.random() * comparisons.length)]();
}
function formatNumber(value) {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}
//# sourceMappingURL=main.js.map
