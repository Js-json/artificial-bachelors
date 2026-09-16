import { PdfEngine } from './pdfEngine.js';
import { PageEditorCanvas } from './editorCanvas.js';
import { PageManager } from './pageManager.js';
import { exportModifiedPdf } from './pdfExporter.js';
import { createSamplePdf } from './samplePdf.js';

class AppController {
  constructor() {
    this.pdfEngine = new PdfEngine();
    this.editorCanvases = new Map(); // pageNum -> PageEditorCanvas
    this.pageAnnotationsMap = {}; // pageNum -> Array of annotations
    
    this.currentZoom = 1.0;
    this.activeTool = 'select';
    this.currentFileName = 'document.pdf';

    this.initUI();
  }

  initUI() {
    // DOM Elements
    this.btnOpenFile = document.getElementById('btn-open-file');
    this.btnSelectFile = document.getElementById('btn-select-file');
    this.btnLoadSample = document.getElementById('btn-load-sample');
    this.fileInput = document.getElementById('file-input');
    this.imageStampInput = document.getElementById('image-stamp-input');
    this.btnExportPdf = document.getElementById('btn-export-pdf');

    this.dropzoneOverlay = document.getElementById('dropzone-overlay');
    this.dropzoneCard = document.getElementById('dropzone-card');
    this.viewportArea = document.getElementById('viewport-area');
    this.pagesContainer = document.getElementById('pages-container');

    this.docNameLabel = document.getElementById('doc-name');
    this.pageIndicator = document.getElementById('page-indicator');

    // Sidebar & Pages
    this.btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    this.pagesSidebar = document.getElementById('pages-sidebar');
    this.thumbnailList = document.getElementById('thumbnail-list');
    this.btnAddBlankPage = document.getElementById('btn-add-blank-page');
    this.btnDeleteCurrentPage = document.getElementById('btn-delete-current-page');

    // Property Inputs
    this.propColor = document.getElementById('prop-color');
    this.propSize = document.getElementById('prop-size');
    this.propStroke = document.getElementById('prop-stroke');
    this.propOpacity = document.getElementById('prop-opacity');
    this.btnDeleteSelected = document.getElementById('btn-delete-selected');

    // Zoom Controls
    this.btnZoomIn = document.getElementById('btn-zoom-in');
    this.btnZoomOut = document.getElementById('btn-zoom-out');
    this.btnZoomReset = document.getElementById('btn-zoom-reset');
    this.zoomValueText = document.getElementById('zoom-value');

    // Actions & Tools
    this.btnUndo = document.getElementById('btn-undo');
    this.btnClearPage = document.getElementById('btn-clear-page');

    // Instantiate PageManager
    this.pageManager = new PageManager(
      this.pdfEngine,
      this.thumbnailList,
      (deletedPage) => this.handlePageOrderChange(deletedPage),
      (pageNum) => this.handlePageSelect(pageNum)
    );

    this.bindEvents();
  }

  bindEvents() {
    // File open triggers
    this.btnOpenFile.addEventListener('click', () => this.fileInput.click());
    this.btnSelectFile.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    this.btnLoadSample.addEventListener('click', () => this.loadSampleDocument());

    // Drag and Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      this.viewportArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    this.viewportArea.addEventListener('dragover', () => this.dropzoneCard.classList.add('dragover'));
    this.viewportArea.addEventListener('dragleave', () => this.dropzoneCard.classList.remove('dragover'));
    this.viewportArea.addEventListener('drop', (e) => {
      this.dropzoneCard.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type === 'application/pdf') {
        this.loadFile(files[0]);
      } else {
        this.showToast('Please drop a valid PDF file.', 'warning');
      }
    });

    // Tool Selection
    const toolBtns = document.querySelectorAll('.tool-btn[data-tool]');
    toolBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (tool === 'image') {
          this.imageStampInput.click();
          return;
        }
        this.setActiveTool(tool);
      });
    });

    this.imageStampInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          this.setActiveTool('image');
          const currentCanvas = this.editorCanvases.get(this.pageManager.activePageIndex);
          if (currentCanvas) {
            currentCanvas.setPendingImage(evt.target.result);
            this.showToast('Click anywhere on page to place image/signature');
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
      this.editorCanvases.forEach(editor => editor.setProperties(props));
    };

    this.propColor.addEventListener('input', notifyPropsChange);
    this.propSize.addEventListener('input', notifyPropsChange);
    this.propStroke.addEventListener('input', notifyPropsChange);
    this.propOpacity.addEventListener('input', notifyPropsChange);

    this.btnDeleteSelected.addEventListener('click', () => {
      const editor = this.editorCanvases.get(this.pageManager.activePageIndex);
      if (editor) {
        const deleted = editor.deleteSelected();
        if (deleted) this.showToast('Selection / Area Deleted');
      }
    });

    // Global Keyboard Delete / Backspace Shortcut Listener
    window.addEventListener('keydown', (e) => {
      const activeElement = document.activeElement;
      const isInput = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
      if (!isInput && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        const editor = this.editorCanvases.get(this.pageManager.activePageIndex);
        if (editor) {
          const deleted = editor.deleteSelected();
          if (deleted) this.showToast('Selection / Area Deleted');
        }
      }
    });

    // Sidebar & Pages
    this.btnToggleSidebar.addEventListener('click', () => {
      this.pagesSidebar.classList.toggle('collapsed');
    });

    this.btnAddBlankPage.addEventListener('click', () => {
      if (this.pdfEngine.rawBytes) {
        this.pageManager.addBlankPage();
        this.showToast('Blank Page Added');
      }
    });

    if (this.btnDeleteCurrentPage) {
      this.btnDeleteCurrentPage.addEventListener('click', () => {
        if (this.pdfEngine.rawBytes) {
          this.pageManager.deletePage(this.pageManager.activePageIndex);
          this.showToast('Page Deleted');
        }
      });
    }

    // Zoom Controls
    this.btnZoomIn.addEventListener('click', () => this.setZoom(this.currentZoom + 0.15));
    this.btnZoomOut.addEventListener('click', () => this.setZoom(this.currentZoom - 0.15));
    this.btnZoomReset.addEventListener('click', () => this.setZoom(1.0));

    // Undo & Clear
    this.btnUndo.addEventListener('click', () => {
      const editor = this.editorCanvases.get(this.pageManager.activePageIndex);
      if (editor) editor.undo();
    });

    this.btnClearPage.addEventListener('click', () => {
      const editor = this.editorCanvases.get(this.pageManager.activePageIndex);
      if (editor) editor.clearAll();
    });

    // Export PDF
    this.btnExportPdf.addEventListener('click', () => this.handleExportPdf());
  }

  setActiveTool(tool) {
    this.activeTool = tool;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      if (btn.dataset.tool === tool) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    this.editorCanvases.forEach(editor => editor.setTool(tool));
  }

  setZoom(zoom) {
    this.currentZoom = Math.min(Math.max(0.5, zoom), 2.5);
    this.zoomValueText.textContent = `${Math.round(this.currentZoom * 100)}%`;
    this.renderAllPages();
  }

  async handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      await this.loadFile(file);
    }
  }

  async loadFile(file) {
    this.currentFileName = file.name;
    this.docNameLabel.textContent = file.name;

    const arrayBuffer = await file.arrayBuffer();
    await this.loadPdfBuffer(arrayBuffer);
  }

  async loadSampleDocument() {
    this.showToast('Generating Sample PDF...', 'info');
    this.currentFileName = 'sample_document.pdf';
    this.docNameLabel.textContent = 'sample_document.pdf';

    const pdfBytes = await createSamplePdf();
    await this.loadPdfBuffer(pdfBytes.buffer);
    this.showToast('Sample PDF Loaded!');
  }

  async loadPdfBuffer(buffer) {
    try {
      this.dropzoneOverlay.style.opacity = '0';
      setTimeout(() => {
        this.dropzoneOverlay.style.display = 'none';
      }, 300);

      await this.pdfEngine.loadDocument(buffer);
      this.pageManager.initFromEngine();

      this.btnExportPdf.disabled = false;
      await this.renderAllPages();

      this.showToast(`Loaded ${this.pdfEngine.numPages} Page(s)`);
    } catch (err) {
      console.error('Failed to load PDF:', err);
      this.showToast('Error opening PDF document.', 'danger');
    }
  }

  async renderAllPages() {
    this.pagesContainer.innerHTML = '';
    this.editorCanvases.clear();

    const totalPages = this.pageManager.pageList.length;
    this.pageIndicator.textContent = `Page ${this.pageManager.activePageIndex} / ${totalPages}`;

    for (let idx = 0; idx < totalPages; idx++) {
      const pageNum = idx + 1;
      const pageMeta = this.pageManager.pageList[idx];

      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'page-wrapper';
      pageWrapper.id = `page-wrapper-${pageNum}`;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.className = 'page-canvas';
      pageWrapper.appendChild(pageCanvas);

      this.pagesContainer.appendChild(pageWrapper);

      let dims;
      if (pageMeta.isBlank) {
        dims = { width: Math.floor(600 * this.currentZoom), height: Math.floor(800 * this.currentZoom) };
        pageCanvas.width = dims.width;
        pageCanvas.height = dims.height;
        pageCanvas.style.width = `${dims.width}px`;
        pageCanvas.style.height = `${dims.height}px`;

        const ctx = pageCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, dims.width, dims.height);
      } else {
        dims = await this.pdfEngine.renderPage(pageMeta.originalIndex, pageCanvas, this.currentZoom);
      }

      if (dims) {
        pageWrapper.style.width = `${dims.width}px`;
        pageWrapper.style.height = `${dims.height}px`;

        // Create editor overlay
        const editor = new PageEditorCanvas(
          pageWrapper,
          pageNum,
          dims.width,
          dims.height,
          (pNum, anns) => {
            // Save annotation state with scaled coordinates metadata
            const scaledAnns = anns.map(ann => ({
              ...ann,
              canvasWidth: dims.width,
              canvasHeight: dims.height,
            }));
            this.pageAnnotationsMap[pageMeta.id] = scaledAnns;
          }
        );

        editor.setTool(this.activeTool);
        editor.setProperties({
          color: this.propColor.value,
          size: this.propSize.value,
          stroke: this.propStroke.value,
          opacity: this.propOpacity.value,
        });

        // Restore existing annotations if any
        const existingAnns = this.pageAnnotationsMap[pageMeta.id] || this.pageAnnotationsMap[pageNum];
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
      pageWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.pageIndicator.textContent = `Page ${pageNum} / ${this.pageManager.pageList.length}`;
  }

  async handleExportPdf() {
    try {
      this.showToast('Preparing edited PDF for download...', 'info');

      const exportedBytes = await exportModifiedPdf(
        this.pdfEngine.rawBytes,
        this.pageManager.pageList,
        this.pageAnnotationsMap
      );

      const blob = new Blob([exportedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited_${this.currentFileName}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showToast('PDF Exported Successfully!', 'success');
    } catch (err) {
      console.error('Failed to export PDF:', err);
      this.showToast('Export failed. Check console for details.', 'danger');
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    if (type === 'success') {
      icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    } else if (type === 'warning' || type === 'danger') {
      icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    }

    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  new AppController();
});
