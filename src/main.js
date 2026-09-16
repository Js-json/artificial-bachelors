import { PdfEngine } from "./pdfEngine.js";
import { PageEditorCanvas } from "./editorCanvas.js";
import { PageManager } from "./pageManager.js";
import { exportModifiedPdf } from "./pdfExporter.js";
import { createSamplePdf } from "./samplePdf.js";

class AppController {
  constructor() {
    this.pdfEngine = new PdfEngine();
    this.editorCanvases = new Map(); // pageNum -> PageEditorCanvas
    this.pageAnnotationsMap = {}; // pageNum -> Array of annotations

    this.currentZoom = 1.0;
    this.activeTool = "select";
    this.currentFileName = "document.pdf";
    this.selectedPassage = null;

    this.initUI();
  }

  initUI() {
    // DOM Elements
    this.btnOpenFile = document.getElementById("btn-open-file");
    this.btnSelectFile = document.getElementById("btn-select-file");
    this.btnLoadSample = document.getElementById("btn-load-sample");
    this.fileInput = document.getElementById("file-input");
    this.imageStampInput = document.getElementById("image-stamp-input");
    this.btnExportPdf = document.getElementById("btn-export-pdf");

    this.dropzoneOverlay = document.getElementById("dropzone-overlay");
    this.dropzoneCard = document.getElementById("dropzone-card");
    this.viewportArea = document.getElementById("viewport-area");
    this.pagesContainer = document.getElementById("pages-container");

    this.docNameLabel = document.getElementById("doc-name");
    this.pageIndicator = document.getElementById("page-indicator");

    // Sidebar & Pages
    this.btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
    this.pagesSidebar = document.getElementById("pages-sidebar");
    this.thumbnailList = document.getElementById("thumbnail-list");
    this.btnAddBlankPage = document.getElementById("btn-add-blank-page");
    this.btnDeleteCurrentPage = document.getElementById(
      "btn-delete-current-page",
    );

    // Property Inputs
    this.propColor = document.getElementById("prop-color");
    this.propSize = document.getElementById("prop-size");
    this.propStroke = document.getElementById("prop-stroke");
    this.propOpacity = document.getElementById("prop-opacity");
    this.btnDeleteSelected = document.getElementById("btn-delete-selected");

    // Zoom Controls
    this.btnZoomIn = document.getElementById("btn-zoom-in");
    this.btnZoomOut = document.getElementById("btn-zoom-out");
    this.btnZoomReset = document.getElementById("btn-zoom-reset");
    this.zoomValueText = document.getElementById("zoom-value");

    // Actions & Tools
    this.btnUndo = document.getElementById("btn-undo");
    this.btnClearPage = document.getElementById("btn-clear-page");

    // Instantiate PageManager
    this.pageManager = new PageManager(
      this.pdfEngine,
      this.thumbnailList,
      (deletedPage) => this.handlePageOrderChange(deletedPage),
      (pageNum) => this.handlePageSelect(pageNum),
    );

    this.bindEvents();
  }

  bindEvents() {
    // File open triggers
    const openFilePicker = () => {
      this.fileInput.value = "";
      this.fileInput.click();
    };
    this.btnOpenFile.addEventListener("click", openFilePicker);
    this.btnSelectFile.addEventListener("click", openFilePicker);
    this.fileInput.addEventListener("change", (e) => this.handleFileSelect(e));
    this.btnLoadSample.addEventListener("click", async () => {
      this.btnLoadSample.disabled = true;
      try {
        await this.loadSampleDocument();
      } catch (err) {
        console.error("Failed to load sample PDF:", err);
        this.showToast("Could not generate the sample PDF.", "danger");
      } finally {
        this.btnLoadSample.disabled = false;
      }
    });

    // Drag and Drop
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      this.viewportArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    this.viewportArea.addEventListener("dragover", () =>
      this.dropzoneCard.classList.add("dragover"),
    );
    this.viewportArea.addEventListener("dragleave", () =>
      this.dropzoneCard.classList.remove("dragover"),
    );
    this.viewportArea.addEventListener("drop", (e) => {
      this.dropzoneCard.classList.remove("dragover");
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type === "application/pdf") {
        this.loadFile(files[0]);
      } else {
        this.showToast("Please drop a valid PDF file.", "warning");
      }
    });

    // Tool Selection
    const toolBtns = document.querySelectorAll(".tool-btn[data-tool]");
    toolBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tool = btn.dataset.tool;
        if (tool === "image") {
          this.imageStampInput.click();
          return;
        }
        this.setActiveTool(tool);
      });
    });

    this.imageStampInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          this.setActiveTool("image");
          const currentCanvas = this.editorCanvases.get(
            this.pageManager.activePageIndex,
          );
          if (currentCanvas) {
            currentCanvas.setPendingImage(evt.target.result);
            this.showToast("Click anywhere on page to place image/signature");
          }
        };
        reader.readAsDataURL(file);
      }
    });

    // Properties change
    const notifyPropsChange = () => {
      const props = {
        color: this.propColor.value,
        size: this.propSize.value,
        stroke: this.propStroke.value,
        opacity: this.propOpacity.value,
      };
      this.editorCanvases.forEach((editor) => editor.setProperties(props));
    };

    this.propColor.addEventListener("input", notifyPropsChange);
    this.propSize.addEventListener("input", notifyPropsChange);
    this.propStroke.addEventListener("input", notifyPropsChange);
    this.propOpacity.addEventListener("input", notifyPropsChange);

    this.btnDeleteSelected.addEventListener("click", () => {
      const editor = this.editorCanvases.get(this.pageManager.activePageIndex);
      if (editor) {
        const deleted = editor.deleteSelected();
        if (deleted) this.showToast("Selection / Area Deleted");
      }
    });

    // Global Keyboard Delete / Backspace Shortcut Listener
    window.addEventListener("keydown", (e) => {
      const activeElement = document.activeElement;
      const isInput =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA");
      if (!isInput && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        const editor = this.editorCanvases.get(
          this.pageManager.activePageIndex,
        );
        if (editor) {
          const deleted = editor.deleteSelected();
          if (deleted) this.showToast("Selection / Area Deleted");
        }
      }
    });

    // Sidebar & Pages
    this.btnToggleSidebar.addEventListener("click", () => {
      this.pagesSidebar.classList.toggle("collapsed");
    });

    this.btnAddBlankPage.addEventListener("click", () => {
      if (this.pdfEngine.rawBytes) {
        this.pageManager.addBlankPage();
        this.showToast("Blank Page Added");
      }
    });

    if (this.btnDeleteCurrentPage) {
      this.btnDeleteCurrentPage.addEventListener("click", () => {
        if (this.pdfEngine.rawBytes) {
          this.pageManager.deletePage(this.pageManager.activePageIndex);
          this.showToast("Page Deleted");
        }
      });
    }

    // Zoom Controls
    this.btnZoomIn.addEventListener("click", () =>
      this.setZoom(this.currentZoom + 0.15),
    );
    this.btnZoomOut.addEventListener("click", () =>
      this.setZoom(this.currentZoom - 0.15),
    );
    this.btnZoomReset.addEventListener("click", () => this.setZoom(1.0));

    // Undo & Clear
    this.btnUndo.addEventListener("click", () => {
      const editor = this.editorCanvases.get(this.pageManager.activePageIndex);
      if (editor) editor.undo();
    });

    this.btnClearPage.addEventListener("click", () => {
      const editor = this.editorCanvases.get(this.pageManager.activePageIndex);
      if (editor) editor.clearAll();
    });

    // Export PDF
    this.btnExportPdf.addEventListener("click", () => this.handleExportPdf());

    // MS Word Style Text Interaction Popup & Context Menu
    this.setupWordStyleTextInteractions();
  }

  setActiveTool(tool) {
    this.activeTool = tool;
    document.querySelectorAll(".tool-btn[data-tool]").forEach((btn) => {
      if (btn.dataset.tool === tool) btn.classList.add("active");
      else btn.classList.remove("active");
    });

    this.editorCanvases.forEach((editor) => editor.setTool(tool));
  }

  setZoom(zoom) {
    this.currentZoom = Math.min(Math.max(0.5, zoom), 2.5);
    this.zoomValueText.textContent = `${Math.round(this.currentZoom * 100)}%`;
    this.renderAllPages();
  }

  async handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      try {
        await this.loadFile(file);
      } catch (err) {
        console.error("Failed to open selected PDF:", err);
        this.showToast("Could not open that PDF file.", "danger");
      }
    }
  }

  async loadFile(file) {
    this.currentFileName = file.name;
    this.docNameLabel.textContent = file.name;

    const arrayBuffer = await file.arrayBuffer();
    await this.loadPdfBuffer(arrayBuffer);
  }

  async loadSampleDocument() {
    this.showToast("Generating Sample PDF...", "info");
    this.currentFileName = "sample_document.pdf";
    this.docNameLabel.textContent = "sample_document.pdf";

    const pdfBytes = await createSamplePdf();
    await this.loadPdfBuffer(pdfBytes.buffer);
    this.showToast("Sample PDF Loaded!");
  }

  async loadPdfBuffer(buffer) {
    try {
      this.dropzoneOverlay.style.opacity = "0";
      setTimeout(() => {
        this.dropzoneOverlay.style.display = "none";
      }, 300);

      await this.pdfEngine.loadDocument(buffer);
      this.pageManager.initFromEngine();

      this.btnExportPdf.disabled = false;
      await this.renderAllPages();

      this.showToast(`Loaded ${this.pdfEngine.numPages} Page(s)`);
    } catch (err) {
      console.error("Failed to load PDF:", err);
      this.showToast("Error opening PDF document.", "danger");
    }
  }

  async renderAllPages() {
    this.pagesContainer.innerHTML = "";
    this.editorCanvases.clear();

    const totalPages = this.pageManager.pageList.length;
    this.pageIndicator.textContent = `Page ${this.pageManager.activePageIndex} / ${totalPages}`;

    for (let idx = 0; idx < totalPages; idx++) {
      const pageNum = idx + 1;
      const pageMeta = this.pageManager.pageList[idx];

      const pageWrapper = document.createElement("div");
      pageWrapper.className = "page-wrapper";
      pageWrapper.id = `page-wrapper-${pageNum}`;
      pageWrapper.dataset.pageNumber = pageNum;

      const pageCanvas = document.createElement("canvas");
      pageCanvas.className = "page-canvas";
      pageWrapper.appendChild(pageCanvas);

      this.pagesContainer.appendChild(pageWrapper);

      let dims;
      if (pageMeta.isBlank) {
        dims = {
          width: Math.floor(600 * this.currentZoom),
          height: Math.floor(800 * this.currentZoom),
        };
        pageCanvas.width = dims.width;
        pageCanvas.height = dims.height;
        pageCanvas.style.width = `${dims.width}px`;
        pageCanvas.style.height = `${dims.height}px`;

        const ctx = pageCanvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, dims.width, dims.height);
      } else {
        dims = await this.pdfEngine.renderPage(
          pageMeta.originalIndex,
          pageCanvas,
          this.currentZoom,
        );
      }

      if (dims) {
        pageWrapper.style.width = `${dims.width}px`;
        pageWrapper.style.height = `${dims.height}px`;

        // Render PDF character selection layer
        if (!pageMeta.isBlank) {
          const textLayerDiv = document.createElement("div");
          textLayerDiv.className = "text-layer";
          pageWrapper.appendChild(textLayerDiv);
          this.pdfEngine.renderTextLayer(
            pageMeta.originalIndex,
            textLayerDiv,
            this.currentZoom,
          );
        }

        // Create editor overlay
        const editor = new PageEditorCanvas(
          pageWrapper,
          pageNum,
          dims.width,
          dims.height,
          (pNum, anns) => {
            // Save annotation state with scaled coordinates metadata
            const scaledAnns = anns.map((ann) => ({
              ...ann,
              canvasWidth: dims.width,
              canvasHeight: dims.height,
            }));
            this.pageAnnotationsMap[pageMeta.id] = scaledAnns;
          },
        );

        editor.setTool(this.activeTool);
        editor.setProperties({
          color: this.propColor.value,
          size: this.propSize.value,
          stroke: this.propStroke.value,
          opacity: this.propOpacity.value,
        });

        // Restore existing annotations if any
        const existingAnns =
          this.pageAnnotationsMap[pageMeta.id] ||
          this.pageAnnotationsMap[pageNum];
        if (existingAnns) {
          editor.annotations = [...existingAnns];
          editor.redraw();
        }

        this.editorCanvases.set(pageNum, editor);
      }
    }
  }

  handlePageOrderChange(deletedPage) {
    if (deletedPage && deletedPage.id) {
      delete this.pageAnnotationsMap[deletedPage.id];
    }
    this.renderAllPages();
  }

  handlePageSelect(pageNum) {
    const pageWrapper = document.getElementById(`page-wrapper-${pageNum}`);
    if (pageWrapper) {
      pageWrapper.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    this.pageIndicator.textContent = `Page ${pageNum} / ${this.pageManager.pageList.length}`;
  }

  async handleExportPdf() {
    try {
      this.showToast("Preparing edited PDF for download...", "info");

      const exportedBytes = await exportModifiedPdf(
        this.pdfEngine.rawBytes,
        this.pageManager.pageList,
        this.pageAnnotationsMap,
      );

      const blob = new Blob([exportedBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `edited_${this.currentFileName}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showToast("PDF Exported Successfully!", "success");
    } catch (err) {
      console.error("Failed to export PDF:", err);
      this.showToast("Export failed. Check console for details.", "danger");
    }
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = "toast";

    let icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    if (type === "success") {
      icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    } else if (type === "warning" || type === "danger") {
      icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    }

    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  setupWordStyleTextInteractions() {
    const floatingToolbar = document.getElementById("word-floating-toolbar");
    const contextMenu = document.getElementById("word-context-menu");

    if (!floatingToolbar || !contextMenu) return;

    const btnCopy = document.getElementById("word-btn-copy");
    const btnPaste = document.getElementById("word-btn-paste");
    const btnHighlight = document.getElementById("word-btn-highlight");
    const btnDelete = document.getElementById("word-btn-delete");

    const ctxCopy = document.getElementById("ctx-copy");
    const ctxPaste = document.getElementById("ctx-paste");
    const ctxHighlight = document.getElementById("ctx-highlight");
    const ctxDelete = document.getElementById("ctx-delete");

    let currentSelectedText = "";
    let currentSelectionRange = null;

    // Monitor text selection to trigger MS Word Floating Mini Toolbar
    const updateFloatingToolbar = () => {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : "";

      if (text.length > 0 && selection.rangeCount > 0) {
        currentSelectedText = text;
        const range = selection.getRangeAt(0);
        currentSelectionRange = range.cloneRange();
        const rect = range.getBoundingClientRect();

        const viewportArea = document.getElementById("viewport-area");
        if (viewportArea) {
          const viewportRect = viewportArea.getBoundingClientRect();
          const top = rect.top - viewportRect.top + viewportArea.scrollTop - 48;
          const left =
            rect.left -
            viewportRect.left +
            viewportArea.scrollLeft +
            rect.width / 2 -
            100;

          floatingToolbar.style.top = `${Math.max(10, top)}px`;
          floatingToolbar.style.left = `${Math.max(10, left)}px`;
          floatingToolbar.classList.remove("hidden");
        }
      } else if (
        document.activeElement &&
        !floatingToolbar.contains(document.activeElement)
      ) {
        floatingToolbar.classList.add("hidden");
      }
    };

    document.addEventListener("selectionchange", updateFloatingToolbar);
    document.addEventListener("mouseup", updateFloatingToolbar);

    const captureSelection = () => {
      const selection = window.getSelection();
      if (
        !selection ||
        selection.rangeCount === 0 ||
        !selection.toString().trim()
      ) {
        this.selectedPassage = null;
        window.codrSelection = null;
        return;
      }

      const range = selection.getRangeAt(0);
      const startElement =
        range.startContainer.nodeType === Node.ELEMENT_NODE
          ? range.startContainer
          : range.startContainer.parentElement;
      const pageWrapper = startElement?.closest(".page-wrapper");
      if (
        !pageWrapper ||
        !range.commonAncestorContainer.parentElement?.closest(".text-layer")
      )
        return;

      const pageRect = pageWrapper.getBoundingClientRect();
      const rangeRect = range.getBoundingClientRect();
      const rect = {
        x: Math.max(0, rangeRect.left - pageRect.left) / pageRect.width,
        y: Math.max(0, rangeRect.top - pageRect.top) / pageRect.height,
        width: Math.min(rangeRect.width, pageRect.width) / pageRect.width,
        height: Math.min(rangeRect.height, pageRect.height) / pageRect.height,
      };
      this.selectedPassage = {
        text: selection.toString(),
        pageNumber: Number(pageWrapper.dataset.pageNumber),
        rect,
        boundingClientRect: {
          left: rangeRect.left,
          top: rangeRect.top,
          width: rangeRect.width,
          height: rangeRect.height,
        },
      };
      window.codrSelection = this.selectedPassage;
    };

    document.addEventListener("selectionchange", captureSelection);
    document.addEventListener("mouseup", captureSelection);

    // Actions
    const doCopy = () => {
      if (currentSelectedText) {
        navigator.clipboard.writeText(currentSelectedText);
        this.showToast("Text copied to clipboard!", "success");
      }
    };

    const doPaste = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          const editor = this.editorCanvases.get(
            this.pageManager.activePageIndex,
          );
          if (editor) {
            editor.addTextInput(100, 100);
            this.showToast("Pasted text element onto page!", "success");
          }
        }
      } catch (err) {
        this.showToast("Clipboard access granted", "info");
      }
    };

    const doHighlight = () => {
      if (currentSelectionRange) {
        const rects = currentSelectionRange.getClientRects();
        const selectedPage =
          this.selectedPassage?.pageNumber || this.pageManager.activePageIndex;
        const editor = this.editorCanvases.get(selectedPage);
        if (editor) {
          const pageWrapper = document.getElementById(
            `page-wrapper-${selectedPage}`,
          );
          if (pageWrapper) {
            const pRect = pageWrapper.getBoundingClientRect();
            editor.saveState();
            for (let r of rects) {
              editor.annotations.push({
                id: Date.now() + Math.random(),
                type: "highlight",
                points: [
                  {
                    x: r.left - pRect.left,
                    y: r.top - pRect.top + r.height / 2,
                  },
                  {
                    x: r.right - pRect.left,
                    y: r.top - pRect.top + r.height / 2,
                  },
                ],
                color: "#f59e0b",
                strokeWidth: Math.max(14, r.height),
                opacity: 0.45,
              });
            }
            editor.notifyChange();
            editor.redraw();
            this.showToast("Text highlighted!", "success");
          }
        }
      }
    };

    const doDelete = () => {
      if (currentSelectionRange) {
        const rects = currentSelectionRange.getClientRects();
        const selectedPage =
          this.selectedPassage?.pageNumber || this.pageManager.activePageIndex;
        const editor = this.editorCanvases.get(selectedPage);
        if (editor) {
          const pageWrapper = document.getElementById(
            `page-wrapper-${selectedPage}`,
          );
          if (pageWrapper) {
            const pRect = pageWrapper.getBoundingClientRect();
            editor.saveState();
            for (let r of rects) {
              editor.annotations.push({
                id: Date.now() + Math.random(),
                type: "whiteout",
                x: r.left - pRect.left,
                y: r.top - pRect.top,
                width: r.width,
                height: r.height,
              });
            }
            editor.notifyChange();
            editor.redraw();
            window.getSelection().removeAllRanges();
            floatingToolbar.classList.add("hidden");
            this.showToast("Text erased!", "success");
          }
        }
      } else {
        const editor = this.editorCanvases.get(
          this.pageManager.activePageIndex,
        );
        if (editor) editor.deleteSelected();
      }
    };

    btnCopy.addEventListener("click", doCopy);
    ctxCopy.addEventListener("click", () => {
      doCopy();
      contextMenu.classList.add("hidden");
    });

    btnPaste.addEventListener("click", doPaste);
    ctxPaste.addEventListener("click", () => {
      doPaste();
      contextMenu.classList.add("hidden");
    });

    btnHighlight.addEventListener("click", doHighlight);
    ctxHighlight.addEventListener("click", () => {
      doHighlight();
      contextMenu.classList.add("hidden");
    });

    btnDelete.addEventListener("click", doDelete);
    ctxDelete.addEventListener("click", () => {
      doDelete();
      contextMenu.classList.add("hidden");
    });

    // Right Click MS Word Context Menu
    window.addEventListener("contextmenu", (e) => {
      if (
        e.target.closest(".page-wrapper") ||
        e.target.closest(".annotation-layer") ||
        e.target.closest(".text-layer")
      ) {
        e.preventDefault();
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.classList.remove("hidden");
      } else {
        contextMenu.classList.add("hidden");
      }
    });

    window.addEventListener("click", (e) => {
      if (!contextMenu.contains(e.target)) {
        contextMenu.classList.add("hidden");
      }
    });
  }
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  new AppController();
});
