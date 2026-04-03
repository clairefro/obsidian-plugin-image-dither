import {
  App,
  Editor,
  MarkdownFileInfo,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  TFile,
} from "obsidian";

type DitherAlgorithm = "none" | "threshold" | "ordered" | "floyd-steinberg";

type Preset = {
  name: string;
  algorithm: DitherAlgorithm;
  threshold: number;
  spread: number;
  resizePercent: number;
};

const PRESETS: Preset[] = [
  {
    name: "Balanced",
    algorithm: "floyd-steinberg",
    threshold: 128,
    spread: 30,
    resizePercent: 100,
  },
  {
    name: "Small",
    algorithm: "floyd-steinberg",
    threshold: 128,
    spread: 20,
    resizePercent: 30,
  },
  {
    name: "Sharp",
    algorithm: "threshold",
    threshold: 140,
    spread: 70,
    resizePercent: 100,
  },
];

type ImageDitherSettings = {
  enabled: boolean;
};

const DEFAULT_SETTINGS: ImageDitherSettings = {
  enabled: true,
};

export default class ImageDitherPlugin extends Plugin {
  private modalOpen = false;
  private settings: ImageDitherSettings = DEFAULT_SETTINGS;
  private ribbonIconEl: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();

    this.ribbonIconEl = this.addRibbonIcon(
      "image",
      "Toggle Image Dither",
      () => {
        this.settings.enabled = !this.settings.enabled;
        void this.saveSettings();
        this.updateRibbonState();
        new Notice(
          `Image Dither ${this.settings.enabled ? "enabled" : "disabled"}`,
        );
      },
    );
    this.updateRibbonState();

    this.registerEvent(
      this.app.workspace.on(
        "editor-paste",
        (
          evt: ClipboardEvent,
          _editor: Editor,
          info: MarkdownView | MarkdownFileInfo,
        ) => {
          if (!this.settings.enabled || this.modalOpen) return;
          const file = this.extractImageFromPaste(evt);
          if (!file) return;
          const view =
            info instanceof MarkdownView
              ? info
              : this.app.workspace.getActiveViewOfType(MarkdownView);
          if (!view) return;
          blockEvent(evt);
          this.openDitherModal(file, view);
        },
      ),
    );

    this.registerEvent(
      this.app.workspace.on(
        "editor-drop",
        (
          evt: DragEvent,
          _editor: Editor,
          info: MarkdownView | MarkdownFileInfo,
        ) => {
          if (!this.settings.enabled || this.modalOpen) return;
          const file = this.extractImageFromDrop(evt);
          if (!file) return;
          const view =
            info instanceof MarkdownView
              ? info
              : this.app.workspace.getActiveViewOfType(MarkdownView);
          if (!view) return;
          blockEvent(evt);
          this.openDitherModal(file, view);
        },
      ),
    );
  }

  onunload() {}

  private async loadSettings() {
    const loaded = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...(loaded ?? {}) };
  }

  private async saveSettings() {
    await this.saveData(this.settings);
  }

  private updateRibbonState() {
    if (!this.ribbonIconEl) return;
    this.ribbonIconEl.toggleClass("is-disabled", !this.settings.enabled);
    this.ribbonIconEl.setAttribute(
      "aria-label",
      `Image Dither: ${this.settings.enabled ? "enabled" : "disabled"}`,
    );
  }

  private extractImageFromPaste(evt: ClipboardEvent): File | null {
    if (!evt.clipboardData) return null;
    const imageItem = Array.from(evt.clipboardData.items).find((item) =>
      item.type.startsWith("image/"),
    );
    return imageItem?.getAsFile() ?? null;
  }

  private extractImageFromDrop(evt: DragEvent): File | null {
    if (!evt.dataTransfer || evt.dataTransfer.files.length === 0) return null;
    return (
      Array.from(evt.dataTransfer.files).find((file) =>
        file.type.startsWith("image/"),
      ) ?? null
    );
  }

  private openDitherModal(file: File, view: MarkdownView) {
    this.modalOpen = true;
    const modal = new DitherModal(this.app, file, view, () => {
      this.modalOpen = false;
    });
    modal.open();
  }
}

class DitherModal extends Modal {
  private file: File;
  private view: MarkdownView;
  private onCloseCallback: () => void;

  private previewBeforeImg?: HTMLImageElement;
  private previewAfterImg?: HTMLImageElement;
  private previewBeforeInfo?: HTMLDivElement;
  private previewAfterInfo?: HTMLDivElement;
  private previewBeforeName?: HTMLDivElement;
  private previewSavings?: HTMLDivElement;
  private useDitheredBtn?: HTMLButtonElement;
  private useOriginalBtn?: HTMLButtonElement;
  private ditherNameInput?: HTMLInputElement;
  private ditherNameBase = "";
  private resizeValueEl?: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private algorithm: DitherAlgorithm = "floyd-steinberg";
  private threshold = 128;
  private spread = 30;
  private resizePercent = 100;
  private invertColors = false;
  private originalImage?: HTMLImageElement;
  private originalBytes = 0;
  private originalPreviewUrl: string | null = null;

  private latestPreviewBlob?: Blob;
  private previewUpdateTimer: number | null = null;

  constructor(app: App, file: File, view: MarkdownView, onClose: () => void) {
    super(app);
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
      attr: { alt: "Original preview" },
    });
    this.previewBeforeInfo = beforeCard.createDiv({
      cls: "dither-preview-meta",
    });
    this.previewBeforeName = beforeCard.createDiv({ cls: "dither-preview-name" });

    const afterCard = previewGrid.createDiv({ cls: "dither-preview-card" });
    afterCard.createDiv({ cls: "dither-preview-label", text: "Dithered" });
    const afterFrame = afterCard.createDiv({ cls: "dither-preview" });
    this.previewAfterImg = afterFrame.createEl("img", {
      attr: { alt: "Dithered preview" },
    });
    this.previewAfterInfo = afterCard.createDiv({ cls: "dither-preview-meta" });
    const afterNameRow = afterCard.createDiv({ cls: "dither-filename-row" });
    this.ditherNameInput = afterNameRow.createEl("input", {
      cls: "dither-filename-input",
      attr: { type: "text", spellcheck: "false", placeholder: "filename" },
    });
    afterNameRow.createDiv({ cls: "dither-filename-ext", text: ".png" });
    this.ditherNameBase = `${stripExtension(this.file.name)}-dither`;
    this.ditherNameInput.value = sanitizeFileBaseName(this.ditherNameBase);

    this.previewSavings = previewCol.createDiv({ cls: "dither-savings" });

    const controlsWrap = this.contentEl.createDiv({
      cls: "dither-controls-wrap",
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
      { value: "none", label: "None" },
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
        value: String(this.threshold),
      },
    });
    const thresholdValue = thresholdRow.createDiv({
      cls: "dither-value",
      text: String(this.threshold),
    });

    const spreadRow = controls.createDiv({ cls: "dither-row" });
    spreadRow.createEl("label", { text: "Sharpness" });
    const spreadInput = spreadRow.createEl("input", {
      attr: { type: "range", min: "0", max: "100", value: String(this.spread) },
    });
    const spreadValue = spreadRow.createDiv({
      cls: "dither-value",
      text: `${this.spread}%`,
    });

    const resizeRow = controls.createDiv({ cls: "dither-row" });
    resizeRow.createEl("label", { text: "Resize (%)" });
    const resizeInput = resizeRow.createEl("input", {
      attr: {
        type: "range",
        min: "10",
        max: "100",
        value: String(this.resizePercent),
      },
    });
    const resizeValue = resizeRow.createDiv({
      cls: "dither-value",
      text: `${this.resizePercent}%`,
    });
    this.resizeValueEl = resizeValue;
    this.updateResizeValueLabel();

    const presetRow = controls.createDiv({ cls: "dither-row" });
    presetRow.createEl("label", { text: "Preset" });
    const presetSelect = presetRow.createEl("select");
    PRESETS.forEach((preset) => {
      presetSelect.createEl("option", {
        value: preset.name,
        text: preset.name,
      });
    });
    presetSelect.insertAdjacentHTML(
      "afterbegin",
      `<option value="">Custom</option>`,
    );
    presetSelect.value = "";

    const invertRow = controls.createDiv({ cls: "dither-row" });
    invertRow.createEl("label", { text: "Invert colors" });
    const invertToggle = invertRow.createEl("input", {
      attr: { type: "checkbox" },
    });
    invertToggle.checked = this.invertColors;
    invertRow.createDiv({ cls: "dither-value", text: "" });

    const actions = controls.createDiv({ cls: "dither-actions" });
    const cancelBtn = actions.createEl("button", { text: "Cancel" });
    const useOriginalBtn = actions.createEl("button", {
      text: "Use original",
    });
    const saveBtn = actions.createEl("button", { text: "Use dithered" });
    saveBtn.addClass("mod-cta");
    this.useDitheredBtn = saveBtn;
    this.useOriginalBtn = useOriginalBtn;

    algorithmSelect.addEventListener("change", () => {
      this.algorithm = algorithmSelect.value as DitherAlgorithm;
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

  private async loadOriginal() {
    this.originalBytes = this.file.size;
    if (this.previewBeforeName) {
      this.previewBeforeName.setText(this.file.name);
    }
    if (this.useOriginalBtn) {
      this.useOriginalBtn.setText(
        `Use original (${formatBytes(this.originalBytes)})`,
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

  private queuePreviewUpdate(immediate = false) {
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

  private async updatePreview() {
    if (
      !this.originalImage ||
      !this.previewAfterImg ||
      !this.previewAfterInfo ||
      !this.previewBeforeInfo ||
      !this.previewSavings
    ) {
      return;
    }

    const { width, height } = this.getTargetSize(
      this.originalImage.naturalWidth,
      this.originalImage.naturalHeight,
    );

    this.canvas.width = width;
    this.canvas.height = height;

    this.ctx.drawImage(this.originalImage, 0, 0, width, height);

    const imageData = this.ctx.getImageData(0, 0, width, height);
    this.applyDither(imageData);
    this.ctx.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      this.canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) return;

    this.latestPreviewBlob = blob;
    const previewUrl = URL.createObjectURL(blob);
    this.previewAfterImg.src = previewUrl;
    this.previewAfterImg.onload = () => URL.revokeObjectURL(previewUrl);

    const savedBytes = Math.max(0, this.originalBytes - blob.size);
    const savedPercent = this.originalBytes
      ? Math.round(
          ((this.originalBytes - blob.size) / this.originalBytes) * 1000,
        ) / 10
      : 0;
    const largerBy = blob.size - this.originalBytes;
    const isDanger = savedPercent <= 0;
    const isWarn = savedPercent > 0 && savedPercent <= 10;

    this.previewBeforeInfo.setText(
      `${formatBytes(this.originalBytes)}\n${this.originalImage.naturalWidth} x ${this.originalImage.naturalHeight} px`,
    );
    this.previewAfterInfo.setText(
      `${formatBytes(blob.size)}\n${width} x ${height} px`,
    );
    this.previewSavings.setText(
      isDanger
        ? `Saved: ${savedPercent}% (larger by ${formatBytes(Math.max(0, largerBy))})`
        : `Saved: ${savedPercent}% (-${formatBytes(savedBytes)})`,
    );
    this.previewSavings.toggleClass("is-danger", isDanger);
    this.previewSavings.toggleClass("is-warn", isWarn);
    this.previewSavings.toggleClass("is-good", !isDanger && !isWarn);
    this.previewSavings.style.color = isDanger
      ? "var(--text-error)"
      : isWarn
        ? "var(--text-warning, #d9a620)"
        : "var(--text-success, #4caf50)";

    if (this.useDitheredBtn) {
      const label = isDanger
        ? `Use dithered (${formatBytes(blob.size)}, +${Math.abs(savedPercent)}%)`
        : `Use dithered (${formatBytes(blob.size)}, -${savedPercent}%)`;
      this.useDitheredBtn.setText(label);
    }
  }

  private getTargetSize(originalWidth: number, originalHeight: number) {
    const scale = this.resizePercent / 100;
    const targetWidth = Math.max(1, Math.round(originalWidth * scale));
    const targetHeight = Math.max(1, Math.round(originalHeight * scale));

    return { width: targetWidth, height: targetHeight };
  }

  private updateResizeValueLabel() {
    if (!this.resizeValueEl) return;
    this.resizeValueEl.setText(`${this.resizePercent}%`);
  }

  private applyDither(imageData: ImageData) {
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
          data[idx + 2],
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
        [15, 7, 13, 5],
      ];
      const scale = 16;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const gray = grayBase[y * width + x];
          const threshold = (bayer[y % 4][x % 4] / scale) * 255;
          const bw = gray > threshold ? 255 : 0;
          const v = this.invertColors ? 255 - bw : bw;
          data[idx] = v;
          data[idx + 1] = v;
          data[idx + 2] = v;
        }
      }
      return;
    }

    // Floyd-Steinberg
    const buffer = Float32Array.from(grayBase);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const oldPixel = buffer[idx];
        const newPixel = oldPixel > this.threshold ? 255 : 0;
        const error = oldPixel - newPixel;
        buffer[idx] = newPixel;

        if (x + 1 < width) buffer[idx + 1] += (error * 7) / 16;
        if (x - 1 >= 0 && y + 1 < height)
          buffer[idx + width - 1] += (error * 3) / 16;
        if (y + 1 < height) buffer[idx + width] += (error * 5) / 16;
        if (x + 1 < width && y + 1 < height)
          buffer[idx + width + 1] += (error * 1) / 16;
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

  private async saveImage(useOriginal: boolean) {
    if (!this.originalImage) return;

    const editor = this.view.editor;
    const sourceFile = this.view.file;
    if (!sourceFile) {
      new Notice("No active file to insert image into.");
      return;
    }

    try {
      let blobToSave: Blob | null = null;
      if (useOriginal) {
        blobToSave = this.file;
      } else {
        if (!this.latestPreviewBlob) {
          await this.updatePreview();
        }
        blobToSave = this.latestPreviewBlob ?? null;
      }

      if (!blobToSave) {
        new Notice("No image data to save.");
        return;
      }

      const arrayBuffer = await blobToSave.arrayBuffer();
      const extension = useOriginal ? getExtension(this.file.type) : "png";
      const baseName = useOriginal
        ? sanitizeFileBaseName(stripExtension(this.file.name))
        : this.getDitherBaseName();
      const fileName = `${baseName}.${extension}`;
      const folderPath = getAttachmentFolder(this.app, sourceFile);
      const targetPath = folderPath ? `${folderPath}/${fileName}` : fileName;
      const filePath = getUniquePath(this.app, targetPath);

      const created = await this.app.vault.createBinary(filePath, arrayBuffer);
      const link = this.app.fileManager.generateMarkdownLink(
        created,
        sourceFile.path,
      );
      const embed = link.startsWith("!") ? link : `!${link}`;
      editor.replaceRange(embed, editor.getCursor());

      this.close();
    } catch (err) {
      console.error(err);
      new Notice("Failed to save dithered image.");
    }
  }

  private getDitherBaseName() {
    const fromInput = this.ditherNameInput?.value?.trim() ?? "";
    const safe = sanitizeFileBaseName(fromInput || this.ditherNameBase || "dithered-image");
    if (this.ditherNameInput) {
      this.ditherNameInput.value = safe;
    }
    return safe;
  }
}

function toGray(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function applySharpness(
  buffer: Float32Array,
  width: number,
  height: number,
  amount: number,
) {
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

function clampByte(value: number) {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return value;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function getExtension(mime: string) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
  };
  return map[mime] ?? "png";
}

function getAttachmentFolder(app: App, sourceFile: TFile) {
  const vault = app.vault as any;
  const configValue =
    typeof vault.getConfig === "function"
      ? vault.getConfig("attachmentFolderPath")
      : "";

  if (!configValue || configValue.trim() === "") {
    return sourceFile.parent?.path ?? "";
  }

  if (configValue.startsWith("./")) {
    const base = sourceFile.parent?.path ?? "";
    const rel = configValue.replace("./", "");
    return base ? `${base}/${rel}` : rel;
  }

  return configValue;
}

function stripExtension(fileName: string) {
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0) return fileName;
  return fileName.slice(0, idx);
}

function sanitizeFileBaseName(name: string) {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/g, "");
  return cleaned || "image";
}

function getUniquePath(app: App, initialPath: string) {
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

function blockEvent(evt: Event) {
  evt.preventDefault();
  evt.stopPropagation();
  evt.stopImmediatePropagation();
  (evt as unknown as { returnValue?: boolean }).returnValue = false;
}
