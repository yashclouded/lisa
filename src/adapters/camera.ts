import { detectSpectralROI, extractProfileFromROI, ExtractedImageSpectrum } from './imageRoi';

export interface CameraCapabilities {
  hasManualExposure: boolean;
  hasManualFocus: boolean;
  hasTorch: boolean;
}

export class CameraAdapter {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

  public async startCamera(videoElement: HTMLVideoElement): Promise<CameraCapabilities> {
    this.videoElement = videoElement;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('CAMERA_UNSUPPORTED: Camera access not supported by browser environment.');
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();

      const track = this.stream.getVideoTracks()[0];
      if (!track) {
        throw new Error('NO_VIDEO_TRACK: Camera stream did not provide a video track.');
      }
      const capabilities = track.getCapabilities ? (track.getCapabilities() as unknown as Record<string, unknown>) : {};

      // Try applying manual constraints if supported
      try {
        if ('exposureMode' in capabilities) {
          await track.applyConstraints({
            advanced: [{ exposureMode: 'manual', exposureCompensation: 0 } as unknown as MediaTrackConstraintSet],
          });
        }
      } catch (e) {
        console.warn('Advanced exposure constraints could not be applied:', e);
      }

      return {
        hasManualExposure: 'exposureMode' in capabilities,
        hasManualFocus: 'focusMode' in capabilities,
        hasTorch: 'torch' in capabilities,
      };
    } catch (err: unknown) {
      throw new Error(`PERMISSION_DENIED: Failed to access camera: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  public stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  public isRunning(): boolean {
    return !!this.stream && this.stream.active;
  }

  public captureFrame(targetCanvas?: HTMLCanvasElement | null): ExtractedImageSpectrum {
    if (!this.stream || !this.stream.active) {
      throw new Error('CAMERA_INACTIVE: Camera stream is not active. Start camera first.');
    }
    if (!this.videoElement) {
      throw new Error('NO_VIDEO_ELEMENT: No video element attached to camera adapter.');
    }
    return CameraAdapter.extractSpectrumFromVideo(this.videoElement, targetCanvas);
  }

  public static extractSpectrumFromVideo(
    video: HTMLVideoElement,
    targetCanvas?: HTMLCanvasElement | null,
    targetBins: number = 151
  ): ExtractedImageSpectrum {
    if (video.readyState < 2) {
      throw new Error('VIDEO_NOT_READY: Video frame is not ready. Wait for camera feed to initialize.');
    }
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width <= 0 || height <= 0) {
      throw new Error('ZERO_DIMENSIONS: Camera video track has zero dimensions.');
    }

    const canvas = targetCanvas || (typeof document !== 'undefined' ? document.createElement('canvas') : null);
    if (!canvas) {
      throw new Error('CANVAS_FAILURE: Unable to allocate canvas for frame capture.');
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('CANVAS_FAILURE: Failed to acquire 2D rendering context for frame capture.');
    }

    ctx.drawImage(video, 0, 0, width, height);
    const roi = detectSpectralROI(ctx, width, height);
    if (roi.width <= 0 || roi.height <= 0) {
      throw new Error('ROI_DETECTION_FAILURE: Failed to identify spectral region of interest in camera frame.');
    }

    return extractProfileFromROI(ctx, roi, targetBins);
  }
}
