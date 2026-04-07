/**
 * Downloader Module
 * Handles individual and batch (ZIP) downloads
 */

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ImageProcessor } from './imageProcessor.js';

export class Downloader {
  constructor({ frameManager, getGlobalSettings, getAllImageData }) {
    this.frameManager = frameManager;
    this.getGlobalSettings = getGlobalSettings;
    this.getAllImageData = getAllImageData;

    this.loadingOverlay = document.getElementById('loading-overlay');
    this.loadingText = document.getElementById('loading-text');
    this.progressFill = document.getElementById('progress-fill');
    this.progressText = document.getElementById('progress-text');
  }

  /**
   * Download a single processed image
   */
  async downloadSingle(imageId, imageData) {
    const settings = this.getGlobalSettings();

    let photoW = imageData.photo.naturalWidth;
    let photoH = imageData.photo.naturalHeight;
    if (imageData.crop) {
      photoW = imageData.crop.width;
      photoH = imageData.crop.height;
    }

    const framePlacement = this.frameManager.hasFrame(imageData.position)
      ? this.frameManager.calculateFramePlacement(photoW, photoH, imageData.position, imageData.frameSize)
      : null;

    const result = await ImageProcessor.compose({
      photo: imageData.photo,
      crop: imageData.crop,
      brightness: imageData.brightness,
      contrast: imageData.contrast,
      saturation: imageData.saturation,
      frameImage: framePlacement ? framePlacement.frameImg : null,
      framePlacement,
      format: settings.format,
      quality: settings.quality / 100,
    });

    const ext = settings.format === 'png' ? 'png' : 'jpg';
    const baseName = imageData.file.name.replace(/\.[^.]+$/, '');
    const fileName = `${baseName}_framed.${ext}`;

    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Download all processed images as a ZIP
   */
  async downloadAll() {
    const allData = this.getAllImageData();
    const entries = Object.entries(allData);

    if (entries.length === 0) return;

    this._showLoading(entries.length);

    try {
      const zip = new JSZip();
      const settings = this.getGlobalSettings();
      const ext = settings.format === 'png' ? 'png' : 'jpg';

      for (let i = 0; i < entries.length; i++) {
        const [id, imgData] = entries[i];
        this._updateProgress(i + 1, entries.length, imgData.file.name);

        let photoW = imgData.photo.naturalWidth;
        let photoH = imgData.photo.naturalHeight;
        if (imgData.crop) {
          photoW = imgData.crop.width;
          photoH = imgData.crop.height;
        }

        const framePlacement = this.frameManager.hasFrame(imgData.position)
          ? this.frameManager.calculateFramePlacement(photoW, photoH, imgData.position, imgData.frameSize)
          : null;

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

        const baseName = imgData.file.name.replace(/\.[^.]+$/, '');
        const fileName = `${baseName}_framed.${ext}`;
        zip.file(fileName, result.blob);

        // Allow UI to breathe
        await new Promise(r => setTimeout(r, 50));
      }

      this.loadingText.textContent = 'Generando archivo ZIP...';
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 1 },
      }, (metadata) => {
        this.progressFill.style.width = `${metadata.percent.toFixed(0)}%`;
      });

      saveAs(zipBlob, `fotos_procesadas_${Date.now()}.zip`);
    } catch (err) {
      console.error('Download all error:', err);
      alert('Error al generar el ZIP. Intenta de nuevo.');
    } finally {
      this._hideLoading();
    }
  }

  _showLoading(total) {
    this.loadingOverlay.style.display = '';
    this.progressFill.style.width = '0%';
    this.progressText.textContent = `0 / ${total}`;
    this.loadingText.textContent = 'Procesando imágenes...';
  }

  _updateProgress(current, total, filename) {
    const pct = (current / total) * 100;
    this.progressFill.style.width = `${pct}%`;
    this.progressText.textContent = `${current} / ${total}`;
    this.loadingText.textContent = `Procesando: ${filename}`;
  }

  _hideLoading() {
    this.loadingOverlay.style.display = 'none';
  }
}
