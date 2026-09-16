import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export class PdfEngine {
  constructor() {
    this.pdfDoc = null;
    this.rawBytes = null;
    this.numPages = 0;
    this.pages = [];
  }

  async loadDocument(pdfData) {
    // pdfData can be ArrayBuffer or Uint8Array
    this.rawBytes = new Uint8Array(pdfData);
    const loadingTask = pdfjsLib.getDocument({ data: this.rawBytes });
    this.pdfDoc = await loadingTask.promise;
    this.numPages = this.pdfDoc.numPages;
    return this.numPages;
  }

  async renderPage(pageIndex, canvas, scale = 1.25) {
    if (!this.pdfDoc || pageIndex < 1 || pageIndex > this.numPages) return null;

    const page = await this.pdfDoc.getPage(pageIndex);
    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: scale * dpr });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    return {
      width: Math.floor(viewport.width / dpr),
      height: Math.floor(viewport.height / dpr),
      aspectRatio: viewport.width / viewport.height,
    };
  }

  async renderThumbnail(pageIndex, canvas, targetWidth = 180) {
    if (!this.pdfDoc || pageIndex < 1 || pageIndex > this.numPages) return;

    const page = await this.pdfDoc.getPage(pageIndex);
    const initialViewport = page.getViewport({ scale: 1.0 });
    const scale = targetWidth / initialViewport.width;
    const viewport = page.getViewport({ scale });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d');
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
  }
}
