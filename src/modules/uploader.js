/**
 * Uploader Module
 * Handles drag & drop, file selection for frames and photos
 */

export class Uploader {
  constructor({ onFrameLoaded, onPhotosLoaded, onFrameRemoved, onPhotosCleared }) {
    this.onFrameLoaded = onFrameLoaded;
    this.onPhotosLoaded = onPhotosLoaded;
    this.onFrameRemoved = onFrameRemoved;
    this.onPhotosCleared = onPhotosCleared;

    this.frameDropZone = document.getElementById('frame-drop-zone');
    this.frameInput = document.getElementById('frame-input');
    this.frameZoneContent = document.getElementById('frame-zone-content');
    this.framePreviewContainer = document.getElementById('frame-preview-container');
    this.framePreviewImg = document.getElementById('frame-preview-img');
    this.btnRemoveFrame = document.getElementById('btn-remove-frame');

    this.photosDropZone = document.getElementById('photos-drop-zone');
    this.photosInput = document.getElementById('photos-input');
    this.photosCount = document.getElementById('photos-count');
    this.photosCountNumber = document.getElementById('photos-count-number');
    this.btnClearPhotos = document.getElementById('btn-clear-photos');

    this._init();
  }

  _init() {
    // Frame upload
    this._setupDropZone(this.frameDropZone, this.frameInput, (files) => {
      const pngFiles = Array.from(files).filter(f => f.type === 'image/png');
      if (pngFiles.length > 0) {
        this._loadFrame(pngFiles[0]);
      }
    });

    this.btnRemoveFrame.addEventListener('click', (e) => {
      e.stopPropagation();
      this._clearFrame();
    });

    // Photos upload
    this._setupDropZone(this.photosDropZone, this.photosInput, (files) => {
      const imageFiles = Array.from(files).filter(f =>
        ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
      );
      if (imageFiles.length > 0) {
        this.onPhotosLoaded(imageFiles);
      }
    });

    this.btnClearPhotos.addEventListener('click', () => {
      this.onPhotosCleared();
      this.updatePhotosCount(0);
    });
  }

  _setupDropZone(zone, input, onFiles) {
    // Click to open file dialog
    zone.addEventListener('click', (e) => {
      if (e.target.closest('.btn-remove-frame')) return;
      input.click();
    });

    input.addEventListener('change', () => {
      if (input.files.length > 0) {
        onFiles(input.files);
        input.value = '';
      }
    });

    // Drag events
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) {
        onFiles(e.dataTransfer.files);
      }
    });
  }

  _loadFrame(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.framePreviewImg.src = e.target.result;
        this.frameZoneContent.style.display = 'none';
        this.framePreviewContainer.style.display = 'block';
        this.frameDropZone.classList.add('has-content');
        this.onFrameLoaded(img, file);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  _clearFrame() {
    this.frameZoneContent.style.display = '';
    this.framePreviewContainer.style.display = 'none';
    this.frameDropZone.classList.remove('has-content');
    this.framePreviewImg.src = '';
    this.onFrameRemoved();
  }

  updatePhotosCount(count) {
    if (count > 0) {
      this.photosCount.style.display = '';
      this.photosCountNumber.textContent = count;
    } else {
      this.photosCount.style.display = 'none';
    }
  }
}
