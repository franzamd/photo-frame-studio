import './style.css';
import { Uploader } from './modules/uploader.js';
import { FrameManager } from './modules/frameManager.js';
import { ImageProcessor } from './modules/imageProcessor.js';
import { CropTool } from './modules/cropTool.js';
import { PreviewRenderer } from './modules/previewRenderer.js';
import { Downloader } from './modules/downloader.js';

class App {
  constructor() {
    this.images = {}; // Store image data by ID
    this.nextImageId = 1;

    // Global State
    this.globalSettings = {
      position: 'bottom-left', // default
      frameSize: 25,         // percentage
      format: 'jpeg',        // 'jpeg' or 'png'
      quality: 95            // percentage
    };

    this.frameManager = new FrameManager();

    this._initModules();
    this._initUI();
    this._bindGlobalSettings();
  }

  _initModules() {
    this.uploader = new Uploader({
      onFrameLoaded: (img, file) => this._handleFrameLoaded(img, file),
      onFrameRemoved: () => this._handleFrameRemoved(),
      onPhotosLoaded: (files) => this._handlePhotosLoaded(files),
      onPhotosCleared: () => this._handlePhotosCleared()
    });

    this.cropTool = new CropTool({
      onApply: (id, cropData) => this._handleCropApplied(id, cropData),
      onCancel: () => {}
    });

    this.previewRenderer = new PreviewRenderer({
      frameManager: this.frameManager,
      getGlobalSettings: () => this.globalSettings,
      getImageData: (id) => this.images[id]
    });

    this.downloader = new Downloader({
      frameManager: this.frameManager,
      getGlobalSettings: () => this.globalSettings,
      getAllImageData: () => this.images
    });
  }

  _initUI() {
    this.settingsSection = document.getElementById('settings-section');
    this.imagesSection = document.getElementById('images-section');
    this.imagesList = document.getElementById('images-list');

    // Toggle for frames
    this.btnSourceDefault = document.getElementById('btn-source-default');
    this.btnSourceCustom = document.getElementById('btn-source-custom');
    this.defaultFramesZone = document.getElementById('default-frames-zone');
    this.frameDropZone = document.getElementById('frame-drop-zone');

    this.btnSourceDefault.addEventListener('click', () => {
      this.btnSourceDefault.classList.add('active');
      this.btnSourceCustom.classList.remove('active');
      this.defaultFramesZone.style.display = '';
      this.frameDropZone.style.display = 'none';
      this.frameManager.useDefaultFrames = true;
      this._reRenderAllThumbnails();
    });

    this.btnSourceCustom.addEventListener('click', () => {
      this.btnSourceCustom.classList.add('active');
      this.btnSourceDefault.classList.remove('active');
      this.defaultFramesZone.style.display = 'none';
      this.frameDropZone.style.display = '';
      this.frameManager.useDefaultFrames = false;
      this._reRenderAllThumbnails();
    });

    // Global actions
    document.getElementById('btn-apply-all').addEventListener('click', () => this._applyGlobalSettingsToAll());
    document.getElementById('btn-download-all').addEventListener('click', () => this.downloader.downloadAll());
  }

  _bindGlobalSettings() {
    // Position
    const posBtns = document.querySelectorAll('#global-position .position-btn');
    posBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        posBtns.forEach(b => b.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        this.globalSettings.position = target.dataset.position;
      });
    });

    // Frame Size
    const sizeSlider = document.getElementById('global-frame-size');
    const sizeValue = document.getElementById('frame-size-value');
    sizeSlider.addEventListener('input', (e) => {
      this.globalSettings.frameSize = parseInt(e.target.value, 10);
      sizeValue.textContent = `${this.globalSettings.frameSize}%`;
    });

    // Format
    const formatBtns = document.querySelectorAll('.format-btn');
    const qualityGroup = document.getElementById('quality-group');
    formatBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        formatBtns.forEach(b => b.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        this.globalSettings.format = target.dataset.format;
        
        if (this.globalSettings.format === 'png') {
          qualityGroup.style.opacity = '0.5';
          qualityGroup.style.pointerEvents = 'none';
        } else {
          qualityGroup.style.opacity = '1';
          qualityGroup.style.pointerEvents = 'auto';
        }
      });
    });

    // Quality
    const qualitySlider = document.getElementById('global-quality');
    const qualityValue = document.getElementById('quality-value');
    qualitySlider.addEventListener('input', (e) => {
      this.globalSettings.quality = parseInt(e.target.value, 10);
      qualityValue.textContent = `${this.globalSettings.quality}%`;
    });
  }

  // --- Handlers ---

  _handleFrameLoaded(img, file) {
    this.frameManager.setFrame(img);
    this._showToast('success', 'Marco cargado correctamente');
    this._reRenderAllThumbnails();
  }

  _handleFrameRemoved() {
    this.frameManager.clearFrame();
    this._reRenderAllThumbnails();
  }

  _handlePhotosLoaded(files) {
    const promises = Array.from(files).map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const id = `img_${this.nextImageId++}`;
            this.images[id] = {
              id,
              file,
              photo: img,
              crop: null, // {x, y, width, height}
              brightness: 0,
              contrast: 0,
              saturation: 0,
              position: this.globalSettings.position,
              frameSize: this.globalSettings.frameSize
            };
            resolve(this.images[id]);
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then((newImages) => {
      this.settingsSection.style.display = '';
      this.imagesSection.style.display = '';
      
      newImages.forEach(imgData => {
        this._createImageElement(imgData);
      });

      this.uploader.updatePhotosCount(Object.keys(this.images).length);
      this._showToast('success', `${newImages.length} foto(s) agregada(s)`);
    });
  }

  _handlePhotosCleared() {
    this.images = {};
    this.imagesList.innerHTML = '';
    this.settingsSection.style.display = 'none';
    this.imagesSection.style.display = 'none';
  }

  _handleCropApplied(id, cropData) {
    if (this.images[id]) {
      this.images[id].crop = cropData;
      this._updateImageThumbnail(id);
      
      const badge = document.querySelector(`#${id} .crop-badge`);
      if (badge) {
        if (cropData) badge.classList.add('visible');
        else badge.classList.remove('visible');
      }
    }
  }

  _applyGlobalSettingsToAll() {
    Object.values(this.images).forEach(img => {
      img.position = this.globalSettings.position;
      img.frameSize = this.globalSettings.frameSize;
      
      // Update local position UI
      const posBtns = document.querySelectorAll(`#${img.id} .image-position-btn`);
      posBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.position === img.position);
      });

      // Update local size UI
      const sizeSlider = document.getElementById(`sl_size_${img.id}`);
      if (sizeSlider) sizeSlider.value = img.frameSize;
      const sizeVal = document.getElementById(`val_size_${img.id}`);
      if (sizeVal) sizeVal.textContent = `${img.frameSize}%`;
      
      this._updateImageThumbnail(img.id);
    });
    this._showToast('info', 'Configuración aplicada a todas las fotos');
  }

  // --- UI Creation ---

  _createImageElement(imgData) {
    const el = document.createElement('div');
    el.className = 'image-item';
    el.id = imgData.id;

    const sizeKB = (imgData.file.size / 1024).toFixed(1);
    const sizeStr = imgData.file.size > 1024 * 1024 ? `${(imgData.file.size / (1024 * 1024)).toFixed(2)} MB` : `${sizeKB} KB`;

    el.innerHTML = `
      <div class="image-thumb-wrapper">
        <img class="image-thumb" id="thumb_${imgData.id}" alt="thumbnail" />
        <span class="crop-badge">✂️</span>
      </div>
      
      <div class="image-info">
        <div class="image-name" title="${imgData.file.name}">${imgData.file.name}</div>
        <div class="image-meta">
          <span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            ${imgData.photo.naturalWidth}x${imgData.photo.naturalHeight}px
          </span>
          <span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            ${sizeStr}
          </span>
        </div>
        
        <div class="image-settings">
          <div class="image-setting-item">
            <label>Brillo <span id="val_b_${imgData.id}">0</span></label>
            <input type="range" class="slider" id="sl_b_${imgData.id}" min="-100" max="100" value="0">
          </div>
          <div class="image-setting-item">
            <label>Contraste <span id="val_c_${imgData.id}">0</span></label>
            <input type="range" class="slider" id="sl_c_${imgData.id}" min="-100" max="100" value="0">
          </div>
          <div class="image-setting-item">
            <label>Tamaño <span id="val_size_${imgData.id}">${imgData.frameSize}%</span></label>
            <input type="range" class="slider" id="sl_size_${imgData.id}" min="5" max="200" value="${imgData.frameSize}">
          </div>
          <div class="image-setting-item">
            <label>Posición</label>
            <div class="image-position-selector">
              <div class="image-position-btn ${imgData.position === 'bottom-left' ? 'active' : ''}" data-position="bottom-left" title="Inf. Izq"><div class="mini-dot" style="bottom:2px;left:2px;"></div></div>
              <div class="image-position-btn ${imgData.position === 'top-left' ? 'active' : ''}" data-position="top-left" title="Sup. Izq"><div class="mini-dot" style="top:2px;left:2px;"></div></div>
              <div class="image-position-btn ${imgData.position === 'top-right' ? 'active' : ''}" data-position="top-right" title="Sup. Der"><div class="mini-dot" style="top:2px;right:2px;"></div></div>
              <div class="image-position-btn ${imgData.position === 'bottom-right' ? 'active' : ''}" data-position="bottom-right" title="Inf. Der"><div class="mini-dot" style="bottom:2px;right:2px;"></div></div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="image-actions">
        <button class="btn btn-ghost btn-sm btn-crop" data-id="${imgData.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/></svg>
          Recortar
        </button>
        <button class="btn btn-primary btn-sm btn-preview" data-id="${imgData.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Preview
        </button>
        <button class="btn btn-success btn-sm btn-download" data-id="${imgData.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Descargar
        </button>
      </div>
    `;

    this.imagesList.appendChild(el);

    // Bind item events
    this._bindImageItemEvents(imgData.id);
    
    // Initial thumbnail
    this._updateImageThumbnail(imgData.id);
  }

  _bindImageItemEvents(id) {
    const data = this.images[id];
    const el = document.getElementById(id);

    // Filters & Size
    const binds = [
      { sl: `sl_b_${id}`, val: `val_b_${id}`, key: 'brightness' },
      { sl: `sl_c_${id}`, val: `val_c_${id}`, key: 'contrast' },
      { sl: `sl_size_${id}`, val: `val_size_${id}`, key: 'frameSize' }
    ];

    let t;
    binds.forEach(b => {
      const slider = el.querySelector(`#${b.sl}`);
      const valSpan = el.querySelector(`#${b.val}`);
      if (!slider || !valSpan) return;

      slider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        data[b.key] = v;
        
        if (b.key === 'frameSize') {
          valSpan.textContent = `${v}%`;
        } else {
          valSpan.textContent = v > 0 ? `+${v}` : v;
        }
        
        // Debounce thumbnail update for performance
        clearTimeout(t);
        t = setTimeout(() => this._updateImageThumbnail(id), 100);
      });
    });

    // Position override
    const posBtns = el.querySelectorAll('.image-position-btn');
    posBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        posBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        data.position = btn.dataset.position;
        // Don't need to rebuild thumbnail for position change since frame is not in thumbnail
      });
    });

    // Buttons
    el.querySelector('.btn-crop').addEventListener('click', () => {
      this.cropTool.open(data.photo, id, data.file.name, data.crop);
    });
    
    el.querySelector('.btn-preview').addEventListener('click', () => {
      this.previewRenderer.open(id);
    });

    el.querySelector('.btn-download').addEventListener('click', () => {
      this.downloader.downloadSingle(id, data);
    });
  }

  _updateImageThumbnail(id) {
    const data = this.images[id];
    if (!data) return;

    const dataUrl = ImageProcessor.generateThumbnail(data.photo, {
      crop: data.crop,
      brightness: data.brightness,
      contrast: data.contrast,
      saturation: data.saturation,
      maxSize: 200 // Small size for list
    });

    const imgEl = document.getElementById(`thumb_${id}`);
    if (imgEl) imgEl.src = dataUrl;
  }

  _reRenderAllThumbnails() {
    Object.keys(this.images).forEach(id => this._updateImageThumbnail(id));
  }

  // --- Utilities ---

  _showToast(type, message) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '';
    if (type === 'success') icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
    else if (type === 'error') icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    else icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.addEventListener('animationend', () => toast.remove());
    }, 3300);
  }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
