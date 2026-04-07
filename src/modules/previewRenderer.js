/**
 * Preview Renderer Module
 * Renders live preview of the composed image in a modal
 */

import { ImageProcessor } from './imageProcessor.js';

export class PreviewRenderer {
  constructor({ frameManager, getGlobalSettings, getImageData }) {
    this.frameManager = frameManager;
    this.getGlobalSettings = getGlobalSettings;
    this.getImageData = getImageData;

    this.modal = document.getElementById('preview-modal');
    this.canvas = document.getElementById('preview-canvas');
    this.filenameEl = document.getElementById('preview-filename');
    this.infoEl = document.getElementById('preview-info');
    this.btnClose = document.getElementById('preview-close');
    this.btnCloseBtn = document.getElementById('preview-close-btn');
    this.btnDownload = document.getElementById('preview-download');

    this.currentImageId = null;
    this.currentBlob = null;
    this.currentFilename = '';

    this._initEvents();
  }

  _initEvents() {
    this.btnClose.addEventListener('click', () => this.close());
    this.btnCloseBtn.addEventListener('click', () => this.close());
    this.btnDownload.addEventListener('click', () => this._downloadCurrent());

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.style.display !== 'none') {
        this.close();
      }
    });
  }

  async open(imageId) {
    this.currentImageId = imageId;
    const imgData = this.getImageData(imageId);
    if (!imgData) return;

    this.filenameEl.textContent = imgData.file.name;
    this.currentFilename = imgData.file.name;
    this.modal.style.display = '';

    const settings = this.getGlobalSettings();

    // Calculate frame placement
    let photoW = imgData.photo.naturalWidth;
    let photoH = imgData.photo.naturalHeight;
    if (imgData.crop) {
      photoW = imgData.crop.width;
      photoH = imgData.crop.height;
    }

    const framePlacement = this.frameManager.hasFrame(imgData.position)
      ? this.frameManager.calculateFramePlacement(photoW, photoH, imgData.position, imgData.frameSize)
      : null;

    try {
      const result = await ImageProcessor.compose({
        photo: imgData.photo,
        crop: imgData.crop,
        brightness: imgData.brightness,
        contrast: imgData.contrast,
        saturation: imgData.saturation,
        frameImage: framePlacement ? framePlacement.frameImg : null,
        framePlacement,
        format: settings.format,
        quality: settings.quality / 100,
      });

      // Draw to preview canvas
      this.canvas.width = result.canvas.width;
      this.canvas.height = result.canvas.height;

      // Scale down for display
      const maxDisplayW = Math.min(window.innerWidth - 120, 960);
      const maxDisplayH = window.innerHeight * 0.6;
      const displayScale = Math.min(maxDisplayW / result.canvas.width, maxDisplayH / result.canvas.height, 1);

      this.canvas.style.width = `${Math.round(result.canvas.width * displayScale)}px`;
      this.canvas.style.height = `${Math.round(result.canvas.height * displayScale)}px`;

      const ctx = this.canvas.getContext('2d');
      ctx.drawImage(result.canvas, 0, 0);

      this.currentBlob = result.blob;

      // Show info
      const sizeKB = (result.blob.size / 1024).toFixed(1);
      const sizeMB = (result.blob.size / (1024 * 1024)).toFixed(2);
      const sizeStr = result.blob.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
      this.infoEl.textContent = `${result.canvas.width} × ${result.canvas.height}px · ${sizeStr} · ${settings.format.toUpperCase()}`;
    } catch (err) {
      console.error('Preview error:', err);
      this.infoEl.textContent = 'Error al generar la vista previa';
    }
  }

  close() {
    this.modal.style.display = 'none';
    this.currentImageId = null;
    this.currentBlob = null;
  }

  _downloadCurrent() {
    if (!this.currentBlob) return;
    const settings = this.getGlobalSettings();
    const ext = settings.format === 'png' ? 'png' : 'jpg';
    const baseName = this.currentFilename.replace(/\.[^.]+$/, '');
    const fileName = `${baseName}_framed.${ext}`;

    const url = URL.createObjectURL(this.currentBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
