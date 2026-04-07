/**
 * Crop Tool Module
 * Interactive crop selection on a canvas
 */

export class CropTool {
  constructor({ onApply, onCancel }) {
    this.onApply = onApply;
    this.onCancel = onCancel;

    this.modal = document.getElementById('crop-modal');
    this.canvas = document.getElementById('crop-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.selection = document.getElementById('crop-selection');
    this.container = document.getElementById('crop-container');
    this.filenameEl = document.getElementById('crop-filename');

    this.btnApply = document.getElementById('crop-apply');
    this.btnCancel = document.getElementById('crop-cancel');
    this.btnReset = document.getElementById('crop-reset');
    this.btnClose = document.getElementById('crop-close');

    this.photo = null;
    this.imageId = null;
    this.scale = 1;
    this.canvasRect = null;

    // Selection state
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;
    this.startX = 0;
    this.startY = 0;
    this.selRect = { x: 0, y: 0, w: 0, h: 0 };
    this.dragOffset = { x: 0, y: 0 };

    this._initEvents();
  }

  _initEvents() {
    this.btnApply.addEventListener('click', () => this._apply());
    this.btnCancel.addEventListener('click', () => this._cancel());
    this.btnReset.addEventListener('click', () => this._reset());
    this.btnClose.addEventListener('click', () => this._cancel());

    // Mouse events on the container
    this.container.addEventListener('mousedown', (e) => this._onMouseDown(e));
    document.addEventListener('mousemove', (e) => this._onMouseMove(e));
    document.addEventListener('mouseup', () => this._onMouseUp());

    // Close on overlay click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this._cancel();
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.style.display !== 'none') {
        this._cancel();
      }
    });
  }

  open(photo, imageId, filename, existingCrop = null) {
    this.photo = photo;
    this.imageId = imageId;
    this.filenameEl.textContent = filename;

    // Calculate scale to fit canvas in viewport
    const maxW = Math.min(window.innerWidth - 120, 850);
    const maxH = window.innerHeight * 0.6;
    const natW = photo.naturalWidth;
    const natH = photo.naturalHeight;
    this.scale = Math.min(maxW / natW, maxH / natH, 1);

    this.canvas.width = Math.round(natW * this.scale);
    this.canvas.height = Math.round(natH * this.scale);

    this.ctx.drawImage(photo, 0, 0, this.canvas.width, this.canvas.height);

    this.modal.style.display = '';
    this.canvasRect = this.canvas.getBoundingClientRect();

    // Set initial selection
    if (existingCrop) {
      this.selRect = {
        x: (existingCrop.x / natW) * this.canvasRect.width,
        y: (existingCrop.y / natH) * this.canvasRect.height,
        w: (existingCrop.width / natW) * this.canvasRect.width,
        h: (existingCrop.height / natH) * this.canvasRect.height,
      };
      this._updateSelection();
      this.selection.classList.add('active');
    } else {
      this._reset();
    }
  }

  _close() {
    this.modal.style.display = 'none';
    this.selection.classList.remove('active');
    this.photo = null;
  }

  _apply() {
    if (!this.selection.classList.contains('active')) {
      // No selection, apply full image
      this.onApply(this.imageId, null);
    } else {
      // Convert selection from visual coordinates to original image coordinates
      const crop = {
        x: Math.round((this.selRect.x / this.canvasRect.width) * this.photo.naturalWidth),
        y: Math.round((this.selRect.y / this.canvasRect.height) * this.photo.naturalHeight),
        width: Math.round((this.selRect.w / this.canvasRect.width) * this.photo.naturalWidth),
        height: Math.round((this.selRect.h / this.canvasRect.height) * this.photo.naturalHeight),
      };
      // Sanity clamp
      crop.x = Math.max(0, Math.min(crop.x, this.photo.naturalWidth - 1));
      crop.y = Math.max(0, Math.min(crop.y, this.photo.naturalHeight - 1));
      this.onApply(this.imageId, crop);
    }
    this._close();
  }

  _cancel() {
    this.onCancel();
    this._close();
  }

  _reset() {
    this.selRect = { x: 0, y: 0, w: 0, h: 0 };
    this.selection.classList.remove('active');
    this._clearHandles();
  }

  _onMouseDown(e) {
    e.preventDefault();
    this.canvasRect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - this.canvasRect.left;
    const my = e.clientY - this.canvasRect.top;

    // Check if clicking on a handle
    const handle = e.target.closest('.crop-handle');
    if (handle && this.selection.classList.contains('active')) {
      this.isResizing = true;
      this.resizeHandle = handle.dataset.handle;
      this.startX = mx;
      this.startY = my;
      this._savedRect = { ...this.selRect };
      return;
    }

    // Check if clicking inside existing selection (to drag)
    if (this.selection.classList.contains('active')) {
      if (
        mx >= this.selRect.x && mx <= this.selRect.x + this.selRect.w &&
        my >= this.selRect.y && my <= this.selRect.y + this.selRect.h
      ) {
        this.isDragging = true;
        this.dragOffset = { x: mx - this.selRect.x, y: my - this.selRect.y };
        return;
      }
    }

    // Start new selection
    this.isDragging = false;
    this.isResizing = false;
    this.startX = mx;
    this.startY = my;
    this.selRect = { x: mx, y: my, w: 0, h: 0 };
    this.selection.classList.add('active');
    this._isCreating = true;
    this._updateSelection();
    this._addHandles();
  }

  _onMouseMove(e) {
    if (!this.canvasRect) return;
    
    // Use visual CSS coordinates
    const mx = Math.max(0, Math.min(e.clientX - this.canvasRect.left, this.canvasRect.width));
    const my = Math.max(0, Math.min(e.clientY - this.canvasRect.top, this.canvasRect.height));

    if (this._isCreating) {
      const x = Math.min(this.startX, mx);
      const y = Math.min(this.startY, my);
      const w = Math.abs(mx - this.startX);
      const h = Math.abs(my - this.startY);
      this.selRect = { x, y, w, h };
      this._updateSelection();
      return;
    }

    if (this.isDragging) {
      let x = mx - this.dragOffset.x;
      let y = my - this.dragOffset.y;
      x = Math.max(0, Math.min(x, this.canvasRect.width - this.selRect.w));
      y = Math.max(0, Math.min(y, this.canvasRect.height - this.selRect.h));
      this.selRect.x = x;
      this.selRect.y = y;
      this._updateSelection();
      return;
    }

    if (this.isResizing) {
      this._resizeSelection(mx, my);
      return;
    }
  }

  _onMouseUp() {
    this._isCreating = false;
    this.isDragging = false;
    this.isResizing = false;

    // If selection is too small, remove it
    if (this.selRect.w < 10 || this.selRect.h < 10) {
      this._reset();
    } else {
      this._addHandles();
    }
  }

  _resizeSelection(mx, my) {
    const sr = this._savedRect;
    let { x, y, w, h } = sr;

    switch (this.resizeHandle) {
      case 'se':
        w = mx - x;
        h = my - y;
        break;
      case 'sw':
        w = (x + sr.w) - mx;
        h = my - y;
        x = mx;
        break;
      case 'ne':
        w = mx - x;
        h = (y + sr.h) - my;
        y = my;
        break;
      case 'nw':
        w = (x + sr.w) - mx;
        h = (y + sr.h) - my;
        x = mx;
        y = my;
        break;
      case 'n':
        h = (y + sr.h) - my;
        y = my;
        break;
      case 's':
        h = my - y;
        break;
      case 'w':
        w = (x + sr.w) - mx;
        x = mx;
        break;
      case 'e':
        w = mx - x;
        break;
    }

    // Enforce minimum size
    if (w < 20) w = 20;
    if (h < 20) h = 20;

    // Clamp to canvas visual bounds
    x = Math.max(0, x);
    y = Math.max(0, y);
    if (x + w > this.canvasRect.width) w = this.canvasRect.width - x;
    if (y + h > this.canvasRect.height) h = this.canvasRect.height - y;

    this.selRect = { x, y, w, h };
    this._updateSelection();
  }

  _updateSelection() {
    this.selection.style.left = `${(this.selRect.x / this.canvasRect.width) * 100}%`;
    this.selection.style.top = `${(this.selRect.y / this.canvasRect.height) * 100}%`;
    this.selection.style.width = `${(this.selRect.w / this.canvasRect.width) * 100}%`;
    this.selection.style.height = `${(this.selRect.h / this.canvasRect.height) * 100}%`;
  }

  _addHandles() {
    this._clearHandles();
    const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
    handles.forEach(h => {
      const el = document.createElement('div');
      el.className = `crop-handle ${h}`;
      el.dataset.handle = h;
      this.selection.appendChild(el);
    });
  }

  _clearHandles() {
    this.selection.querySelectorAll('.crop-handle').forEach(h => h.remove());
  }
}
