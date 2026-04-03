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
    name: "Balanced",
    algorithm: "floyd-steinberg",
    threshold: 128,
    spread: 30,
    resizePercent: 100
  },
  {
    name: "Small",
    algorithm: "floyd-steinberg",
    threshold: 128,
    spread: 20,
    resizePercent: 30
  },
  {
    name: "Sharp",
    algorithm: "threshold",
    threshold: 140,
    spread: 70,
    resizePercent: 100
  }
];
var DEFAULT_SETTINGS = {
  enabled: true
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
    this.ribbonIconEl = this.addRibbonIcon(
      "image",
      "Toggle Image Dither",
      () => {
        this.settings.enabled = !this.settings.enabled;
        void this.saveSettings();
        this.updateRibbonState();
        new import_obsidian.Notice(
          `Image Dither ${this.settings.enabled ? "enabled" : "disabled"}`
        );
      }
    );
    this.updateRibbonState();
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
  }
  async saveSettings() {
    await this.saveData(this.settings);
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
    const modal = new DitherModal(this.app, file, view, () => {
      this.modalOpen = false;
    });
    modal.open();
  }
};
var DitherModal = class extends import_obsidian.Modal {
  constructor(app, file, view, onClose) {
    super(app);
    this.ditherNameBase = "";
    this.algorithm = "floyd-steinberg";
    this.threshold = 128;
    this.spread = 30;
    this.resizePercent = 100;
    this.invertColors = false;
    this.originalBytes = 0;
    this.originalPreviewUrl = null;
    this.previewUpdateTimer = null;
    this.file = file;
    this.view = view;
    this.onCloseCallback = onClose;
    this.canvas = document.createElement("canvas");
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Failed to create canvas context");
    this.ctx = ctx;
  }
  onOpen() {
    this.modalEl.addClass("dither-modal-container");
    this.contentEl.addClass("dither-modal");
    if (this.modalEl.parentElement) {
      this.modalEl.parentElement.classList.add("dither-modal-overlay");
    }
    this.titleEl.setText("Dither image before saving");
    this.contentEl.style.display = "flex";
    this.contentEl.style.flexDirection = "column";
    this.contentEl.style.gap = "16px";
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
    this.previewBeforeName = beforeCard.createDiv({ cls: "dither-preview-name" });
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
      attr: { type: "text", spellcheck: "false", placeholder: "filename" }
    });
    afterNameRow.createDiv({ cls: "dither-filename-ext", text: ".png" });
    this.ditherNameBase = `${stripExtension(this.file.name)}-dither`;
    this.ditherNameInput.value = sanitizeFileBaseName(this.ditherNameBase);
    this.previewSavings = previewCol.createDiv({ cls: "dither-savings" });
    const controlsWrap = this.contentEl.createDiv({
      cls: "dither-controls-wrap"
    });
    controlsWrap.style.width = "100%";
    const controls = controlsWrap.createDiv();
    controls.addClass("dither-controls");
    const algorithmRow = controls.createDiv({ cls: "dither-row" });
    algorithmRow.createEl("label", { text: "Algorithm" });
    const algorithmSelect = algorithmRow.createEl("select");
    [
      { value: "floyd-steinberg", label: "Floyd-Steinberg" },
      { value: "ordered", label: "Ordered (Bayer)" },
      { value: "threshold", label: "Threshold" },
      { value: "none", label: "None" }
    ].forEach((opt) => {
      algorithmSelect.createEl("option", { value: opt.value, text: opt.label });
    });
    algorithmSelect.value = this.algorithm;
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
    const spreadRow = controls.createDiv({ cls: "dither-row" });
    spreadRow.createEl("label", { text: "Sharpness" });
    const spreadInput = spreadRow.createEl("input", {
      attr: { type: "range", min: "0", max: "100", value: String(this.spread) }
    });
    const spreadValue = spreadRow.createDiv({
      cls: "dither-value",
      text: `${this.spread}%`
    });
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
    this.resizeValueEl = resizeValue;
    this.updateResizeValueLabel();
    const presetRow = controls.createDiv({ cls: "dither-row" });
    presetRow.createEl("label", { text: "Preset" });
    const presetSelect = presetRow.createEl("select");
    PRESETS.forEach((preset) => {
      presetSelect.createEl("option", {
        value: preset.name,
        text: preset.name
      });
    });
    presetSelect.insertAdjacentHTML(
      "afterbegin",
      `<option value="">Custom</option>`
    );
    presetSelect.value = "";
    const invertRow = controls.createDiv({ cls: "dither-row" });
    invertRow.createEl("label", { text: "Invert colors" });
    const invertToggle = invertRow.createEl("input", {
      attr: { type: "checkbox" }
    });
    invertToggle.checked = this.invertColors;
    invertRow.createDiv({ cls: "dither-value", text: "" });
    const actions = controls.createDiv({ cls: "dither-actions" });
    const cancelBtn = actions.createEl("button", { text: "Cancel" });
    const useOriginalBtn = actions.createEl("button", {
      text: "Use original"
    });
    const saveBtn = actions.createEl("button", { text: "Use dithered" });
    saveBtn.addClass("mod-cta");
    this.useDitheredBtn = saveBtn;
    this.useOriginalBtn = useOriginalBtn;
    algorithmSelect.addEventListener("change", () => {
      this.algorithm = algorithmSelect.value;
      presetSelect.value = "";
      this.queuePreviewUpdate();
    });
    thresholdInput.addEventListener("input", () => {
      this.threshold = Number(thresholdInput.value);
      thresholdValue.setText(String(this.threshold));
      presetSelect.value = "";
      this.queuePreviewUpdate();
    });
    spreadInput.addEventListener("input", () => {
      this.spread = Number(spreadInput.value);
      spreadValue.setText(`${this.spread}%`);
      presetSelect.value = "";
      this.queuePreviewUpdate();
    });
    resizeInput.addEventListener("input", () => {
      this.resizePercent = Number(resizeInput.value);
      this.updateResizeValueLabel();
      presetSelect.value = "";
      this.queuePreviewUpdate();
    });
    invertToggle.addEventListener("change", () => {
      this.invertColors = invertToggle.checked;
      presetSelect.value = "";
      this.queuePreviewUpdate();
    });
    presetSelect.addEventListener("change", () => {
      const preset = PRESETS.find((p) => p.name === presetSelect.value);
      if (!preset) return;
      this.algorithm = preset.algorithm;
      this.threshold = preset.threshold;
      this.spread = preset.spread;
      this.resizePercent = preset.resizePercent;
      algorithmSelect.value = this.algorithm;
      thresholdInput.value = String(this.threshold);
      spreadInput.value = String(this.spread);
      resizeInput.value = String(this.resizePercent);
      thresholdValue.setText(String(this.threshold));
      spreadValue.setText(`${this.spread}%`);
      this.updateResizeValueLabel();
      this.queuePreviewUpdate();
    });
    cancelBtn.addEventListener("click", () => this.close());
    useOriginalBtn.addEventListener("click", () => this.saveImage(true));
    saveBtn.addEventListener("click", () => this.saveImage(false));
    this.loadOriginal();
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
    img.onload = () => {
      this.originalImage = img;
      this.updateResizeValueLabel();
      this.queuePreviewUpdate(true);
    };
    img.src = this.originalPreviewUrl;
  }
  queuePreviewUpdate(immediate = false) {
    if (this.previewUpdateTimer) {
      window.clearTimeout(this.previewUpdateTimer);
      this.previewUpdateTimer = null;
    }
    const delay = immediate ? 0 : 80;
    this.previewUpdateTimer = window.setTimeout(() => {
      this.previewUpdateTimer = null;
      void this.updatePreview();
    }, delay);
  }
  async updatePreview() {
    if (!this.originalImage || !this.previewAfterImg || !this.previewAfterInfo || !this.previewBeforeInfo || !this.previewSavings) {
      return;
    }
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
    if (!blob) return;
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
    this.previewSavings.setText(
      isDanger ? `Saved: ${savedPercent}% (larger by ${formatBytes(Math.max(0, largerBy))})` : `Saved: ${savedPercent}% (-${formatBytes(savedBytes)})`
    );
    this.previewSavings.toggleClass("is-danger", isDanger);
    this.previewSavings.toggleClass("is-warn", isWarn);
    this.previewSavings.toggleClass("is-good", !isDanger && !isWarn);
    this.previewSavings.style.color = isDanger ? "var(--text-error)" : isWarn ? "var(--text-warning, #d9a620)" : "var(--text-success, #4caf50)";
    if (this.useDitheredBtn) {
      const label = isDanger ? `Use dithered (${formatBytes(blob.size)}, +${Math.abs(savedPercent)}%)` : `Use dithered (${formatBytes(blob.size)}, -${savedPercent}%)`;
      this.useDitheredBtn.setText(label);
    }
  }
  getTargetSize(originalWidth, originalHeight) {
    const scale = this.resizePercent / 100;
    const targetWidth = Math.max(1, Math.round(originalWidth * scale));
    const targetHeight = Math.max(1, Math.round(originalHeight * scale));
    return { width: targetWidth, height: targetHeight };
  }
  updateResizeValueLabel() {
    if (!this.resizeValueEl) return;
    this.resizeValueEl.setText(`${this.resizePercent}%`);
  }
  applyDither(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const grayBase = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        grayBase[y * width + x] = toGray(
          data[idx],
          data[idx + 1],
          data[idx + 2]
        );
      }
    }
    applySharpness(grayBase, width, height, this.spread / 100);
    if (this.algorithm === "none") {
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
      const folderPath = getAttachmentFolder(this.app, sourceFile);
      const targetPath = folderPath ? `${folderPath}/${fileName}` : fileName;
      const filePath = getUniquePath(this.app, targetPath);
      const created = await this.app.vault.createBinary(filePath, arrayBuffer);
      const link = this.app.fileManager.generateMarkdownLink(
        created,
        sourceFile.path
      );
      const embed = link.startsWith("!") ? link : `!${link}`;
      editor.replaceRange(embed, editor.getCursor());
      this.close();
    } catch (err) {
      console.error(err);
      new import_obsidian.Notice("Failed to save dithered image.");
    }
  }
  getDitherBaseName() {
    var _a, _b, _c;
    const fromInput = (_c = (_b = (_a = this.ditherNameInput) == null ? void 0 : _a.value) == null ? void 0 : _b.trim()) != null ? _c : "";
    const safe = sanitizeFileBaseName(fromInput || this.ditherNameBase || "dithered-image");
    if (this.ditherNameInput) {
      this.ditherNameInput.value = safe;
    }
    return safe;
  }
};
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
function getAttachmentFolder(app, sourceFile) {
  var _a, _b, _c, _d;
  const vault = app.vault;
  const configValue = typeof vault.getConfig === "function" ? vault.getConfig("attachmentFolderPath") : "";
  if (!configValue || configValue.trim() === "") {
    return (_b = (_a = sourceFile.parent) == null ? void 0 : _a.path) != null ? _b : "";
  }
  if (configValue.startsWith("./")) {
    const base = (_d = (_c = sourceFile.parent) == null ? void 0 : _c.path) != null ? _d : "";
    const rel = configValue.replace("./", "");
    return base ? `${base}/${rel}` : rel;
  }
  return configValue;
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
function getUniquePath(app, initialPath) {
  const idx = initialPath.lastIndexOf(".");
  const ext = idx >= 0 ? initialPath.slice(idx) : "";
  const base = idx >= 0 ? initialPath.slice(0, idx) : initialPath;
  let attempt = initialPath;
  let counter = 1;
  while (app.vault.getAbstractFileByPath(attempt)) {
    attempt = `${base}-${counter}${ext}`;
    counter++;
  }
  return attempt;
}
function blockEvent(evt) {
  evt.preventDefault();
  evt.stopPropagation();
  evt.stopImmediatePropagation();
  evt.returnValue = false;
}
//# sourceMappingURL=main.js.map
