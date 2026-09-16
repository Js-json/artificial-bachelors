export class PageManager {
  constructor(pdfEngine, thumbnailListContainer, onPageOrderChange, onPageSelect) {
    this.pdfEngine = pdfEngine;
    this.container = thumbnailListContainer;
    this.onPageOrderChange = onPageOrderChange;
    this.onPageSelect = onPageSelect;

    // Pages array tracking page order and state
    // Each page object: { originalIndex: 1-based, id: string, rotation: 0|90|180|270, isBlank: boolean }
    this.pageList = [];
    this.activePageIndex = 1;
  }

  initFromEngine() {
    this.pageList = [];
    for (let i = 1; i <= this.pdfEngine.numPages; i++) {
      this.pageList.push({
        id: `page-${i}-${Date.now()}`,
        originalIndex: i,
        rotation: 0,
        isBlank: false,
      });
    }
    this.activePageIndex = 1;
    this.renderThumbnails();
  }

  async renderThumbnails() {
    this.container.innerHTML = '';

    for (let idx = 0; idx < this.pageList.length; idx++) {
      const pageMeta = this.pageList[idx];
      const pageNum = idx + 1;

      const card = document.createElement('div');
      card.className = `thumbnail-card ${pageNum === this.activePageIndex ? 'active' : ''}`;
      card.dataset.index = pageNum;

      const canvasContainer = document.createElement('div');
      canvasContainer.className = 'thumbnail-canvas-container';

      const canvas = document.createElement('canvas');
      canvasContainer.appendChild(canvas);

      if (pageMeta.isBlank) {
        canvas.width = 180;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 180, 240);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillText('Blank Page', 55, 120);
      } else {
        await this.pdfEngine.renderThumbnail(pageMeta.originalIndex, canvas, 160);
      }

      // Apply rotation CSS if rotated
      if (pageMeta.rotation !== 0) {
        canvas.style.transform = `rotate(${pageMeta.rotation}deg)`;
      }

      const meta = document.createElement('div');
      meta.className = 'thumbnail-meta';

      const numLabel = document.createElement('span');
      numLabel.className = 'page-number';
      numLabel.textContent = `Page ${pageNum}`;

      const actions = document.createElement('div');
      actions.className = 'thumbnail-actions';

      // Rotate Button
      const btnRotate = document.createElement('button');
      btnRotate.className = 'thumb-btn';
      btnRotate.title = 'Rotate 90°';
      btnRotate.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`;
      btnRotate.addEventListener('click', (e) => {
        e.stopPropagation();
        this.rotatePage(pageNum);
      });

      // Move Up Button
      const btnUp = document.createElement('button');
      btnUp.className = 'thumb-btn';
      btnUp.title = 'Move Up';
      btnUp.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>`;
      btnUp.addEventListener('click', (e) => {
        e.stopPropagation();
        this.movePage(pageNum, -1);
      });

      // Move Down Button
      const btnDown = document.createElement('button');
      btnDown.className = 'thumb-btn';
      btnDown.title = 'Move Down';
      btnDown.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
      btnDown.addEventListener('click', (e) => {
        e.stopPropagation();
        this.movePage(pageNum, 1);
      });

      // Delete Button
      const btnDelete = document.createElement('button');
      btnDelete.className = 'thumb-btn';
      btnDelete.title = 'Delete Page';
      btnDelete.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>`;
      btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deletePage(pageNum);
      });

      actions.appendChild(btnRotate);
      actions.appendChild(btnUp);
      actions.appendChild(btnDown);
      actions.appendChild(btnDelete);

      meta.appendChild(numLabel);
      meta.appendChild(actions);

      card.appendChild(canvasContainer);
      card.appendChild(meta);

      card.addEventListener('click', () => {
        this.setActivePage(pageNum);
      });

      this.container.appendChild(card);
    }
  }

  setActivePage(pageNum) {
    if (pageNum < 1 || pageNum > this.pageList.length) return;
    this.activePageIndex = pageNum;
    
    // Update thumbnail highlights
    const cards = this.container.querySelectorAll('.thumbnail-card');
    cards.forEach((card, idx) => {
      if (idx + 1 === pageNum) {
        card.classList.add('active');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        card.classList.remove('active');
      }
    });

    if (this.onPageSelect) {
      this.onPageSelect(pageNum);
    }
  }

  rotatePage(pageNum) {
    const page = this.pageList[pageNum - 1];
    if (page) {
      page.rotation = (page.rotation + 90) % 360;
      this.renderThumbnails();
      if (this.onPageOrderChange) this.onPageOrderChange();
    }
  }

  movePage(pageNum, direction) {
    const newIdx = pageNum - 1 + direction;
    if (newIdx < 0 || newIdx >= this.pageList.length) return;

    const item = this.pageList.splice(pageNum - 1, 1)[0];
    this.pageList.splice(newIdx, 0, item);

    this.activePageIndex = newIdx + 1;
    this.renderThumbnails();
    if (this.onPageOrderChange) this.onPageOrderChange();
  }

  deletePage(pageNum) {
    if (this.pageList.length <= 1) {
      alert('Document must contain at least one page.');
      return;
    }

    const deletedPage = this.pageList.splice(pageNum - 1, 1)[0];
    if (this.activePageIndex > this.pageList.length) {
      this.activePageIndex = this.pageList.length;
    }

    this.renderThumbnails();
    if (this.onPageOrderChange) this.onPageOrderChange(deletedPage);
  }

  addBlankPage() {
    this.pageList.push({
      id: `blank-${Date.now()}`,
      originalIndex: -1,
      rotation: 0,
      isBlank: true,
    });

    this.activePageIndex = this.pageList.length;
    this.renderThumbnails();
    if (this.onPageOrderChange) this.onPageOrderChange();
  }
}
