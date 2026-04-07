/**
 * Frame Manager Module
 * Handles frame positioning, scaling, and composition logic
 */

export class FrameManager {
  constructor() {
    this.frameImage = null; // Custom uploaded frame
    this.frameNaturalWidth = 0;
    this.frameNaturalHeight = 0;
    
    this.useDefaultFrames = true; // By default, use the 4 specific frames
    this.defaultFrames = {
      'bottom-left': null,
      'top-left': null,
      'top-right': null,
      'bottom-right': null
    };

    this._loadDefaultFrames();
  }

  _loadDefaultFrames() {
    const positions = ['bottom-left', 'top-left', 'top-right', 'bottom-right'];
    positions.forEach(pos => {
      const img = new Image();
      img.onload = () => {
        this.defaultFrames[pos] = img;
      };
      img.src = `/frames/${pos}.png`;
    });
  }

  setFrame(img) {
    this.frameImage = img;
    this.frameNaturalWidth = img.naturalWidth;
    this.frameNaturalHeight = img.naturalHeight;
  }

  clearFrame() {
    this.frameImage = null;
    this.frameNaturalWidth = 0;
    this.frameNaturalHeight = 0;
  }

  hasFrame(position = null) {
    if (this.useDefaultFrames) {
       if (position && this.defaultFrames[position]) return true;
       // If any is loaded when no position provided
       return Object.values(this.defaultFrames).some(img => img !== null);
    }
    return this.frameImage !== null;
  }

  getActiveFrame(position) {
    if (this.useDefaultFrames) {
      return this.defaultFrames[position];
    }
    return this.frameImage;
  }

  /**
   * Calculate the position and size of the frame overlay on a photo.
   * @param {number} photoWidth - Width of the photo
   * @param {number} photoHeight - Height of the photo
   * @param {string} position - 'bottom-left', 'top-left', 'top-right', 'bottom-right'
   * @param {number} sizePercent - Size of frame as % of min(photo dimension)
   * @returns {{ x: number, y: number, width: number, height: number, frameImg: HTMLImageElement }}
   */
  calculateFramePlacement(photoWidth, photoHeight, position, sizePercent) {
    const activeFrame = this.getActiveFrame(position);
    if (!activeFrame) return null;

    // Use the smaller dimension of the photo as the reference for scaling
    const referenceDimension = Math.min(photoWidth, photoHeight);
    
    // Calculate the target height of the frame based on the percentage
    const targetHeight = (referenceDimension * sizePercent) / 100;
    
    // Maintain aspect ratio of the frame
    const aspectRatio = activeFrame.naturalWidth / activeFrame.naturalHeight;
    const targetWidth = targetHeight * aspectRatio;

    // Margin from edges (0% as requested by user to be flush with edges)
    const margin = 0;

    let x, y;

    switch (position) {
      case 'bottom-left':
        x = 0;
        y = photoHeight - targetHeight;
        break;
      case 'top-left':
        x = 0;
        y = 0;
        break;
      case 'top-right':
        x = photoWidth - targetWidth;
        y = 0;
        break;
      case 'bottom-right':
        x = photoWidth - targetWidth;
        y = photoHeight - targetHeight;
        break;
      default:
        x = 0;
        y = photoHeight - targetHeight;
    }

    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(targetWidth),
      height: Math.round(targetHeight),
      frameImg: activeFrame
    };
  }
}
