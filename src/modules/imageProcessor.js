/**
 * Image Processor Module
 * Canvas-based image compositing with filters (brightness, contrast, saturation)
 */

export class ImageProcessor {
  /**
   * Compose the final image with frame overlay and filters.
   * @param {Object} params
   * @param {HTMLImageElement} params.photo - The original photo
   * @param {Object|null} params.crop - Crop data { x, y, width, height } in original image coordinates
   * @param {number} params.brightness - Brightness adjustment (-100 to 100)
   * @param {number} params.contrast - Contrast adjustment (-100 to 100)
   * @param {number} params.saturation - Saturation adjustment (-100 to 100)
   * @param {HTMLImageElement|null} params.frameImage - The frame overlay image
   * @param {Object|null} params.framePlacement - { x, y, width, height } for the frame
   * @param {string} params.format - 'jpeg' or 'png'
   * @param {number} params.quality - 0-1 for JPEG quality
   * @returns {Promise<{ canvas: HTMLCanvasElement, blob: Blob, dataUrl: string }>}
   */
  static async compose({
    photo,
    crop = null,
    brightness = 0,
    contrast = 0,
    saturation = 0,
    frameImage = null,
    framePlacement = null,
    format = 'jpeg',
    quality = 0.95,
  }) {
    // Determine source and output dimensions
    let sx = 0, sy = 0, sw = photo.naturalWidth, sh = photo.naturalHeight;
    if (crop) {
      sx = crop.x;
      sy = crop.y;
      sw = crop.width;
      sh = crop.height;
    }

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');

    // Apply filters via CSS filter on the context
    const filters = [];
    if (brightness !== 0) {
      filters.push(`brightness(${1 + brightness / 100})`);
    }
    if (contrast !== 0) {
      filters.push(`contrast(${1 + contrast / 100})`);
    }
    if (saturation !== 0) {
      filters.push(`saturate(${1 + saturation / 100})`);
    }

    if (filters.length > 0) {
      ctx.filter = filters.join(' ');
    }

    // Draw the photo (with crop)
    ctx.drawImage(photo, sx, sy, sw, sh, 0, 0, sw, sh);

    // Reset filter for frame overlay (frame should not be filtered)
    ctx.filter = 'none';

    // Draw the frame overlay
    if (frameImage && framePlacement) {
      ctx.drawImage(
        frameImage,
        framePlacement.x,
        framePlacement.y,
        framePlacement.width,
        framePlacement.height
      );
    }

    // Export
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, mimeType, format === 'jpeg' ? quality : undefined);
    });

    return {
      canvas,
      blob,
      dataUrl: canvas.toDataURL(mimeType, format === 'jpeg' ? quality : undefined),
    };
  }

  /**
   * Generate a small thumbnail preview with adjustments applied.
   * @param {HTMLImageElement} photo
   * @param {Object} options
   * @returns {string} data URL of the thumbnail
   */
  static generateThumbnail(photo, { crop = null, brightness = 0, contrast = 0, saturation = 0, maxSize = 280 } = {}) {
    let sx = 0, sy = 0, sw = photo.naturalWidth, sh = photo.naturalHeight;
    if (crop) {
      sx = crop.x;
      sy = crop.y;
      sw = crop.width;
      sh = crop.height;
    }

    // Calculate thumbnail dimensions
    const ratio = Math.min(maxSize / sw, maxSize / sh);
    const tw = Math.round(sw * ratio);
    const th = Math.round(sh * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');

    // Apply filters
    const filters = [];
    if (brightness !== 0) filters.push(`brightness(${1 + brightness / 100})`);
    if (contrast !== 0) filters.push(`contrast(${1 + contrast / 100})`);
    if (saturation !== 0) filters.push(`saturate(${1 + saturation / 100})`);
    if (filters.length > 0) ctx.filter = filters.join(' ');

    ctx.drawImage(photo, sx, sy, sw, sh, 0, 0, tw, th);

    return canvas.toDataURL('image/jpeg', 0.8);
  }
}
