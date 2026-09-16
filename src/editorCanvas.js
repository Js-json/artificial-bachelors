export class PageEditorCanvas {
  constructor(containerElement, pageIndex, pageWidth, pageHeight, onAnnotationChange) {
    this.container = containerElement;
    this.pageIndex = pageIndex;
    this.width = pageWidth;
    this.height = pageHeight;
    this.onAnnotationChange = onAnnotationChange;

    this.annotations = [];
    this.history = [];
    this.currentTool = 'select'; // select, text, draw, highlight, rect, circle, line, whiteout, image
    
    // Style settings
    this.activeColor = '#3b82f6';
    this.activeSize = 16;
    this.activeStroke = 3;
    this.activeOpacity = 1.0;

    // Interaction state
    this.isDrawing = false;
    this.currentPath = null;
    this.currentShape = null;
    this.selectedAnnotation = null;
    this.selectedArea = null; // Area selected by dragging in select mode
    this.currentAreaSelection = null;

    this.dragStart = null;
    this.dragInitialPos = null;

    // Pending Image for stamp tool
    this.pendingImageSrc = null;

    this.initCanvas();
  }

  initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'annotation-layer';
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.attachEvents();
    this.redraw();
  }

  setSize(w, h) {
    const scaleX = w / this.width;
    const scaleY = h / this.height;

    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    // Scale annotations
    this.annotations.forEach(ann => {
      if (ann.x !== undefined) ann.x *= scaleX;
      if (ann.y !== undefined) ann.y *= scaleY;
      if (ann.width !== undefined) ann.width *= scaleX;
      if (ann.height !== undefined) ann.height *= scaleY;
      if (ann.cx !== undefined) { ann.cx *= scaleX; ann.rx *= scaleX; }
      if (ann.cy !== undefined) { ann.cy *= scaleY; ann.ry *= scaleY; }
      if (ann.points) {
        ann.points = ann.points.map(pt => ({ x: pt.x * scaleX, y: pt.y * scaleY }));
      }
    });

    this.redraw();
  }

  setTool(tool) {
    this.currentTool = tool;
    if (tool !== 'select') {
      this.selectedAnnotation = null;
      this.selectedArea = null;
    }
    this.redraw();
  }

  setProperties({ color, size, stroke, opacity }) {
    if (color !== undefined) this.activeColor = color;
    if (size !== undefined) this.activeSize = Number(size);
    if (stroke !== undefined) this.activeStroke = Number(stroke);
    if (opacity !== undefined) this.activeOpacity = Number(opacity);

    if (this.selectedAnnotation) {
      if (this.selectedAnnotation.color !== undefined) this.selectedAnnotation.color = this.activeColor;
      if (this.selectedAnnotation.strokeColor !== undefined) this.selectedAnnotation.strokeColor = this.activeColor;
      if (this.selectedAnnotation.fontSize !== undefined) this.selectedAnnotation.fontSize = this.activeSize;
      if (this.selectedAnnotation.strokeWidth !== undefined) this.selectedAnnotation.strokeWidth = this.activeStroke;
      if (this.selectedAnnotation.opacity !== undefined) this.selectedAnnotation.opacity = this.activeOpacity;
      this.redraw();
      this.notifyChange();
    }
  }

  setPendingImage(src) {
    this.pendingImageSrc = src;
  }

  attachEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));

    // Touch support
    this.canvas.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousedown', { clientX: touch.clientX, clientY: touch.clientY });
      this.canvas.dispatchEvent(mouseEvent);
    });

    this.canvas.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', { clientX: touch.clientX, clientY: touch.clientY });
      this.canvas.dispatchEvent(mouseEvent);
    });

    this.canvas.addEventListener('touchend', () => {
      const mouseEvent = new MouseEvent('mouseup', {});
      this.canvas.dispatchEvent(mouseEvent);
    });
  }

  getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  handleMouseDown(e) {
    const pt = this.getCanvasCoords(e);
    this.saveState();

    if (this.currentTool === 'select') {
      const hit = this.hitTest(pt);
      if (hit) {
        this.selectedAnnotation = hit;
        this.selectedArea = null;
        this.dragStart = pt;
        this.dragInitialPos = this.getAnnotationPos(this.selectedAnnotation);
      } else {
        this.selectedAnnotation = null;
        this.selectedArea = null;
        this.isDrawing = true;
        this.currentAreaSelection = {
          startX: pt.x,
          startY: pt.y,
          x: pt.x,
          y: pt.y,
          width: 0,
          height: 0,
        };
      }
      this.redraw();
      return;
    }

    if (this.currentTool === 'text') {
      this.addTextInput(pt.x, pt.y);
      return;
    }

    if (this.currentTool === 'image' && this.pendingImageSrc) {
      this.addImageAnnotation(pt.x, pt.y, this.pendingImageSrc);
      return;
    }

    this.isDrawing = true;

    if (this.currentTool === 'draw' || this.currentTool === 'highlight') {
      const opacity = this.currentTool === 'highlight' ? 0.4 : this.activeOpacity;
      const strokeWidth = this.currentTool === 'highlight' ? Math.max(16, this.activeStroke * 4) : this.activeStroke;
      this.currentPath = {
        id: Date.now() + Math.random(),
        type: this.currentTool,
        points: [pt],
        color: this.activeColor,
        strokeWidth: strokeWidth,
        opacity: opacity,
      };
    } else if (['rect', 'circle', 'line', 'whiteout'].includes(this.currentTool)) {
      this.currentShape = {
        id: Date.now() + Math.random(),
        type: this.currentTool,
        startX: pt.x,
        startY: pt.y,
        x: pt.x,
        y: pt.y,
        width: 0,
        height: 0,
        color: this.currentTool === 'whiteout' ? '#ffffff' : this.activeColor,
        strokeWidth: this.activeStroke,
        opacity: this.currentTool === 'whiteout' ? 1.0 : this.activeOpacity,
      };
    }
  }

  handleMouseMove(e) {
    const pt = this.getCanvasCoords(e);

    if (this.currentTool === 'select' && this.dragStart && this.selectedAnnotation) {
      const dx = pt.x - this.dragStart.x;
      const dy = pt.y - this.dragStart.y;
      this.moveAnnotation(this.selectedAnnotation, dx, dy);
      this.redraw();
      return;
    }

    if (!this.isDrawing) return;

    if (this.currentAreaSelection) {
      this.currentAreaSelection.width = pt.x - this.currentAreaSelection.startX;
      this.currentAreaSelection.height = pt.y - this.currentAreaSelection.startY;
      this.currentAreaSelection.x = Math.min(this.currentAreaSelection.startX, pt.x);
      this.currentAreaSelection.y = Math.min(this.currentAreaSelection.startY, pt.y);
      this.redraw();
    } else if (this.currentPath) {
      this.currentPath.points.push(pt);
      this.redraw();
    } else if (this.currentShape) {
      this.currentShape.width = pt.x - this.currentShape.startX;
      this.currentShape.height = pt.y - this.currentShape.startY;
      this.currentShape.x = Math.min(this.currentShape.startX, pt.x);
      this.currentShape.y = Math.min(this.currentShape.startY, pt.y);
      this.redraw();
    }
  }

  handleMouseUp(e) {
    if (this.dragStart) {
      this.dragStart = null;
      this.dragInitialPos = null;
      this.notifyChange();
    }

    if (this.currentAreaSelection) {
      if (Math.abs(this.currentAreaSelection.width) > 6 && Math.abs(this.currentAreaSelection.height) > 6) {
        this.selectedArea = {
          x: this.currentAreaSelection.x,
          y: this.currentAreaSelection.y,
          width: Math.abs(this.currentAreaSelection.width),
          height: Math.abs(this.currentAreaSelection.height),
        };
      }
      this.currentAreaSelection = null;
      this.isDrawing = false;
      this.redraw();
      return;
    }

    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.currentPath) {
      if (this.currentPath.points.length > 1) {
        this.annotations.push(this.currentPath);
        this.notifyChange();
      }
      this.currentPath = null;
    } else if (this.currentShape) {
      if (Math.abs(this.currentShape.width) > 4 || Math.abs(this.currentShape.height) > 4) {
        this.currentShape.width = Math.abs(this.currentShape.width);
        this.currentShape.height = Math.abs(this.currentShape.height);
        this.annotations.push(this.currentShape);
        this.notifyChange();
      }
      this.currentShape = null;
    }

    this.redraw();
  }

  handleDoubleClick(e) {
    const pt = this.getCanvasCoords(e);
    const hit = this.hitTest(pt);
    if (hit && hit.type === 'text') {
      this.editTextInput(hit);
    }
  }

  addTextInput(x, y, existingAnn = null) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = existingAnn ? existingAnn.text : '';
    input.style.position = 'absolute';
    input.style.left = `${x}px`;
    input.style.top = `${y}px`;
    input.style.font = `${existingAnn ? existingAnn.fontSize : this.activeSize}px Inter, sans-serif`;
    input.style.color = existingAnn ? existingAnn.color : this.activeColor;
    input.style.background = 'rgba(255, 255, 255, 0.95)';
    input.style.border = '2px solid #3b82f6';
    input.style.borderRadius = '4px';
    input.style.padding = '2px 6px';
    input.style.zIndex = '100';
    input.style.outline = 'none';

    this.container.appendChild(input);
    input.focus();

    const commitText = () => {
      const val = input.value.trim();
      if (input.parentNode) input.parentNode.removeChild(input);

      if (val) {
        if (existingAnn) {
          existingAnn.text = val;
        } else {
          this.annotations.push({
            id: Date.now() + Math.random(),
            type: 'text',
            x: x,
            y: y + this.activeSize,
            text: val,
            color: this.activeColor,
            fontSize: this.activeSize,
            fontFamily: 'Helvetica',
            opacity: this.activeOpacity,
          });
        }
        this.notifyChange();
        this.redraw();
      } else if (existingAnn) {
        this.deleteAnnotation(existingAnn);
      }
    };

    input.addEventListener('blur', commitText);
    input.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') commitText();
    });
  }

  editTextInput(ann) {
    this.addTextInput(ann.x, ann.y - ann.fontSize, ann);
  }

  addImageAnnotation(x, y, src) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      const maxDim = 160;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        const aspect = w / h;
        if (w > h) {
          w = maxDim;
          h = maxDim / aspect;
        } else {
          h = maxDim;
          w = maxDim * aspect;
        }
      }

      this.annotations.push({
        id: Date.now() + Math.random(),
        type: 'image',
        x: x - w / 2,
        y: y - h / 2,
        width: w,
        height: h,
        src: src,
        imgElement: img,
        opacity: this.activeOpacity,
      });

      this.notifyChange();
      this.redraw();
    };
  }

  deleteSelected() {
    this.saveState();

    // 1. If an area portion of the PDF is selected, delete/whiteout that area!
    if (this.selectedArea) {
      this.annotations.push({
        id: Date.now() + Math.random(),
        type: 'whiteout',
        x: this.selectedArea.x,
        y: this.selectedArea.y,
        width: this.selectedArea.width,
        height: this.selectedArea.height,
      });
      this.selectedArea = null;
      this.notifyChange();
      this.redraw();
      return true;
    }

    // 2. If an annotation object is selected, delete it!
    if (this.selectedAnnotation) {
      this.deleteAnnotation(this.selectedAnnotation);
      this.selectedAnnotation = null;
      this.redraw();
      return true;
    }

    // 3. If annotations exist on this page, delete the last added edit!
    if (this.annotations.length > 0) {
      this.annotations.pop();
      this.notifyChange();
      this.redraw();
      return true;
    }

    return false;
  }

  deleteAnnotation(ann) {
    this.annotations = this.annotations.filter(a => a !== ann);
    this.notifyChange();
  }

  clearAll() {
    this.saveState();
    this.annotations = [];
    this.selectedAnnotation = null;
    this.selectedArea = null;
    this.redraw();
    this.notifyChange();
  }

  saveState() {
    this.history.push(JSON.stringify(this.annotations));
    if (this.history.length > 30) this.history.shift();
  }

  undo() {
    if (this.history.length > 0) {
      const previous = this.history.pop();
      this.annotations = JSON.parse(previous);
      
      // Re-link image elements
      this.annotations.forEach(ann => {
        if (ann.type === 'image' && ann.src) {
          const img = new Image();
          img.src = ann.src;
          ann.imgElement = img;
        }
      });

      this.selectedAnnotation = null;
      this.selectedArea = null;
      this.redraw();
      this.notifyChange();
    }
  }

  getAnnotationPos(ann) {
    if (ann.x !== undefined) return { x: ann.x, y: ann.y };
    if (ann.points && ann.points.length > 0) return { x: ann.points[0].x, y: ann.points[0].y };
    return { x: 0, y: 0 };
  }

  moveAnnotation(ann, dx, dy) {
    if (this.dragInitialPos) {
      if (ann.x !== undefined) {
        ann.x = this.dragInitialPos.x + dx;
        ann.y = this.dragInitialPos.y + dy;
      } else if (ann.points) {
        if (!ann.originalPoints) {
          ann.originalPoints = ann.points.map(p => ({ x: p.x, y: p.y }));
        }
        ann.points = ann.originalPoints.map(p => ({
          x: p.x + dx,
          y: p.y + dy,
        }));
      }
    }
  }

  hitTest(pt) {
    for (let i = this.annotations.length - 1; i >= 0; i--) {
      const ann = this.annotations[i];
      if (ann.type === 'text') {
        const w = ann.text.length * (ann.fontSize * 0.6);
        const h = ann.fontSize;
        if (pt.x >= ann.x && pt.x <= ann.x + w && pt.y >= ann.y - h && pt.y <= ann.y) {
          return ann;
        }
      } else if (['rect', 'whiteout', 'image'].includes(ann.type)) {
        if (pt.x >= ann.x && pt.x <= ann.x + ann.width && pt.y >= ann.y && pt.y <= ann.y + ann.height) {
          return ann;
        }
      } else if (ann.type === 'circle') {
        const rx = ann.width / 2;
        const ry = ann.height / 2;
        const cx = ann.x + rx;
        const cy = ann.y + ry;
        const dx = (pt.x - cx) / rx;
        const dy = (pt.y - cy) / ry;
        if (dx * dx + dy * dy <= 1) return ann;
      } else if (ann.points) {
        for (let p of ann.points) {
          const dist = Math.hypot(p.x - pt.x, p.y - pt.y);
          if (dist <= (ann.strokeWidth || 10)) return ann;
        }
      }
    }
    return null;
  }

  redraw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw saved annotations
    this.annotations.forEach(ann => this.drawAnnotation(ann));

    // Draw active path or shape
    if (this.currentPath) this.drawAnnotation(this.currentPath);
    if (this.currentShape) this.drawAnnotation(this.currentShape);

    // Draw active dragging area selection box
    if (this.currentAreaSelection) {
      this.ctx.save();
      this.ctx.strokeStyle = '#ef4444';
      this.ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([6, 4]);
      this.ctx.fillRect(this.currentAreaSelection.x, this.currentAreaSelection.y, this.currentAreaSelection.width, this.currentAreaSelection.height);
      this.ctx.strokeRect(this.currentAreaSelection.x, this.currentAreaSelection.y, this.currentAreaSelection.width, this.currentAreaSelection.height);
      this.ctx.restore();
    }

    // Draw active selected area box with delete badge
    if (this.selectedArea) {
      this.ctx.save();
      this.ctx.strokeStyle = '#ef4444';
      this.ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([4, 4]);
      this.ctx.fillRect(this.selectedArea.x, this.selectedArea.y, this.selectedArea.width, this.selectedArea.height);
      this.ctx.strokeRect(this.selectedArea.x, this.selectedArea.y, this.selectedArea.width, this.selectedArea.height);

      // Badge label
      this.ctx.fillStyle = '#ef4444';
      this.ctx.fillRect(this.selectedArea.x, this.selectedArea.y - 20, 140, 20);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '11px Inter, sans-serif';
      this.ctx.fillText('Selected Area (Press Del)', this.selectedArea.x + 6, this.selectedArea.y - 6);

      this.ctx.restore();
    }

    // Draw object selection box
    if (this.selectedAnnotation) {
      this.drawSelectionOutline(this.selectedAnnotation);
    }
  }

  drawAnnotation(ann) {
    this.ctx.save();
    this.ctx.globalAlpha = ann.opacity !== undefined ? ann.opacity : 1.0;

    if (ann.type === 'draw' || ann.type === 'highlight') {
      if (!ann.points || ann.points.length < 2) {
        this.ctx.restore();
        return;
      }
      this.ctx.beginPath();
      this.ctx.strokeStyle = ann.color;
      this.ctx.lineWidth = ann.strokeWidth;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      this.ctx.moveTo(ann.points[0].x, ann.points[0].y);
      for (let i = 1; i < ann.points.length; i++) {
        this.ctx.lineTo(ann.points[i].x, ann.points[i].y);
      }
      this.ctx.stroke();
    } else if (ann.type === 'text') {
      this.ctx.font = `${ann.fontSize}px Inter, sans-serif`;
      this.ctx.fillStyle = ann.color;
      this.ctx.fillText(ann.text, ann.x, ann.y);
    } else if (ann.type === 'whiteout') {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(ann.x, ann.y, ann.width, ann.height);
      this.ctx.strokeStyle = '#e2e8f0';
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([3, 3]);
      this.ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
    } else if (ann.type === 'rect') {
      this.ctx.strokeStyle = ann.color;
      this.ctx.lineWidth = ann.strokeWidth;
      this.ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
    } else if (ann.type === 'circle') {
      this.ctx.beginPath();
      const rx = ann.width / 2;
      const ry = ann.height / 2;
      this.ctx.ellipse(ann.x + rx, ann.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
      this.ctx.strokeStyle = ann.color;
      this.ctx.lineWidth = ann.strokeWidth;
      this.ctx.stroke();
    } else if (ann.type === 'line') {
      this.ctx.beginPath();
      this.ctx.moveTo(ann.startX, ann.startY);
      this.ctx.lineTo(ann.startX + ann.width, ann.startY + ann.height);
      this.ctx.strokeStyle = ann.color;
      this.ctx.lineWidth = ann.strokeWidth;
      this.ctx.stroke();
    } else if (ann.type === 'image' && ann.imgElement) {
      this.ctx.drawImage(ann.imgElement, ann.x, ann.y, ann.width, ann.height);
    }

    this.ctx.restore();
  }

  drawSelectionOutline(ann) {
    this.ctx.save();
    this.ctx.strokeStyle = '#3b82f6';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);

    let bounds = null;
    if (ann.type === 'text') {
      const w = ann.text.length * (ann.fontSize * 0.6);
      bounds = { x: ann.x - 4, y: ann.y - ann.fontSize - 2, w: w + 8, h: ann.fontSize + 6 };
    } else if (['rect', 'whiteout', 'circle', 'image'].includes(ann.type)) {
      bounds = { x: ann.x - 4, y: ann.y - 4, w: ann.width + 8, h: ann.height + 8 };
    } else if (ann.points && ann.points.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      ann.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
      bounds = { x: minX - 6, y: minY - 6, w: (maxX - minX) + 12, h: (maxY - minY) + 12 };
    }

    if (bounds) {
      this.ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    }
    this.ctx.restore();
  }

  notifyChange() {
    if (this.onAnnotationChange) {
      this.onAnnotationChange(this.pageIndex, this.annotations);
    }
  }
}
