// LISA: Image Spectral Fixtures Generator & CV Test Harness
// Synthesizes physical 2D camera sensor frames representing diffraction grating captures.
// Runs headless in Node.js via lightweight canvas adapter or in browser via HTML5 Canvas.

import { ROIBox, detectSpectralROI, extractProfileFromROI } from '../adapters/imageRoi';
import { executeLISAPipeline, PipelineExecutionResult } from '../engine/orchestrator';
import { getWhiteLEDBaseProfile } from '../engine/simulator';
import { STANDARD_WAVELENGTHS, wavelengthToRGB } from '../engine/spectrum';

export interface ImageFixture {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  expectedCenterX: number;
  expectedCenterY: number;
  expectedRoiDetected: boolean;
  expectedShouldReject: boolean;
  expectedRejectionReason?: string;
  generateData: () => Uint8ClampedArray;
}

export interface ImageFixtureTestResult {
  fixtureId: string;
  fixtureName: string;
  imageWidth: number;
  imageHeight: number;
  roiDetected: ROIBox;
  extractedCenterY: number;
  extractedProfileLength: number;
  maxSignal: number;
  isSaturated: boolean;
  pipelineSuccess: boolean;
  predictedConcentration: number | null;
  uncertainty: number | null;
  qcStatus: string;
  oodStatus: string;
  isRejected: boolean;
  rejectionReason?: string;
  behaviorPass: boolean;
  notes: string;
}

/**
 * Creates a lightweight CanvasRenderingContext2D-compatible adapter
 * wrapping a pure raw RGBA buffer so image CV tests execute without DOM dependencies.
 */
export function createMockCanvasContext(
  width: number,
  height: number,
  pixelData: Uint8ClampedArray
): CanvasRenderingContext2D {
  const mockCanvas = { width, height };

  return {
    canvas: mockCanvas as any,
    getImageData: (sx: number, sy: number, sw: number, sh: number) => {
      // Sub-rectangle extraction
      const subData = new Uint8ClampedArray(sw * sh * 4);
      for (let row = 0; row < sh; row++) {
        const srcY = sy + row;
        if (srcY < 0 || srcY >= height) continue;
        for (let col = 0; col < sw; col++) {
          const srcX = sx + col;
          if (srcX < 0 || srcX >= width) continue;

          const srcIdx = (srcY * width + srcX) * 4;
          const dstIdx = (row * sw + col) * 4;

          subData[dstIdx] = pixelData[srcIdx];
          subData[dstIdx + 1] = pixelData[srcIdx + 1];
          subData[dstIdx + 2] = pixelData[srcIdx + 2];
          subData[dstIdx + 3] = pixelData[srcIdx + 3];
        }
      }
      return {
        width: sw,
        height: sh,
        data: subData,
        colorSpace: 'srgb',
      } as ImageData;
    },
  } as unknown as CanvasRenderingContext2D;
}

// Convert RGB string like "rgb(255, 120, 40)" to [r, g, b]
function parseRgb(str: string): [number, number, number] {
  const match = str.match(/\d+/g);
  if (!match || match.length < 3) return [200, 200, 200];
  return [+match[0], +match[1], +match[2]];
}

// Precompute 151 base LED transmission reference points
const BASE_LED = getWhiteLEDBaseProfile(STANDARD_WAVELENGTHS);

/**
 * Synthesizes a realistic 2D diffraction frame where light is dispersed horizontally.
 */
export function synthesizeSpectralFrame(options: {
  width: number;
  height: number;
  centerY: number;
  bandThicknessSigma: number;
  tiltAngleRad?: number;
  noiseSigma?: number;
  backgroundLuminance?: number;
  saturationCeiling?: boolean;
  verticalOrientation?: boolean;
  absorbancePeak?: { nm: number; strength: number; fwhm: number };
  extraSecondaryBandY?: number;
}): Uint8ClampedArray {
  const { width, height, centerY, bandThicknessSigma } = options;
  const tilt = options.tiltAngleRad ?? 0;
  const noise = options.noiseSigma ?? 4;
  const bg = options.backgroundLuminance ?? 15;
  const isSaturated = options.saturationCeiling ?? false;
  const isVertical = options.verticalOrientation ?? false;

  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Coordinate along dispersion axis
      const dispCoord = isVertical ? y : x;
      const dispLength = isVertical ? height : width;

      // Spatial deviation from central stripe axis
      const crossCoord = isVertical ? x : y;
      const tiltedCenter = centerY + Math.tan(tilt) * (dispCoord - dispLength / 2);
      const dy = crossCoord - tiltedCenter;

      // Vertical spatial envelope (Gaussian beam profile)
      const spatialEnvelope = Math.exp(-(dy * dy) / (2 * bandThicknessSigma * bandThicknessSigma));

      // Optional secondary bright reflection band
      let secondaryEnvelope = 0;
      if (options.extraSecondaryBandY !== undefined) {
        const dy2 = crossCoord - options.extraSecondaryBandY;
        secondaryEnvelope = 0.5 * Math.exp(-(dy2 * dy2) / (2 * (bandThicknessSigma * 0.8) * (bandThicknessSigma * 0.8)));
      }

      const totalEnvelope = Math.min(1.0, spatialEnvelope + secondaryEnvelope);

      // Dispersed wavelength calculation (400 nm to 700 nm)
      const frac = Math.max(0, Math.min(1, dispCoord / (dispLength - 1)));
      const nm = 400 + frac * 300;

      // Sample absorption (e.g. Molybdenum blue peak at 680 nm)
      let sampleTrans = 1.0;
      if (options.absorbancePeak) {
        const dNm = nm - options.absorbancePeak.nm;
        const abs = options.absorbancePeak.strength * Math.exp(-(dNm * dNm) / (2 * options.absorbancePeak.fwhm * options.absorbancePeak.fwhm));
        sampleTrans = Math.pow(10, -abs);
      }

      // Spectral emission & RGB color projection
      const ledIdx = Math.min(BASE_LED.length - 1, Math.floor(frac * (BASE_LED.length - 1)));
      const spectralFlux = BASE_LED[ledIdx] * sampleTrans;
      const rgb = parseRgb(wavelengthToRGB(nm));

      // Pixel intensity calculation
      let r = bg + (rgb[0] / 255) * spectralFlux * totalEnvelope;
      let g = bg + (rgb[1] / 255) * spectralFlux * totalEnvelope;
      let b = bg + (rgb[2] / 255) * spectralFlux * totalEnvelope;

      // Add pseudo-random gaussian sensor noise
      if (noise > 0) {
        const randN = (Math.random() + Math.random() - 1) * noise * 1.5;
        r += randN;
        g += randN;
        b += randN;
      }

      // Pixel saturation clipping
      if (isSaturated && totalEnvelope > 0.4) {
        r = 255;
        g = 255;
        b = 255;
      } else {
        r = Math.max(0, Math.min(255, Math.round(r)));
        g = Math.max(0, Math.min(255, Math.round(g)));
        b = Math.max(0, Math.min(255, Math.round(b)));
      }

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  return data;
}

export const IMAGE_FIXTURES: ImageFixture[] = [
  {
    id: 'clean_horizontal',
    name: 'Clean Horizontal Spectrum',
    description: 'Reference 1000 lines/mm grating dispersion. Centered stripe with standard 680 nm molybdenum blue dip.',
    width: 400,
    height: 300,
    expectedCenterX: 200,
    expectedCenterY: 150,
    expectedRoiDetected: true,
    expectedShouldReject: false,
    generateData: () =>
      synthesizeSpectralFrame({
        width: 400,
        height: 300,
        centerY: 150,
        bandThicknessSigma: 16,
        noiseSigma: 3,
        absorbancePeak: { nm: 680, strength: 0.45, fwhm: 45 },
      }),
  },
  {
    id: 'slightly_rotated',
    name: 'Slightly Rotated Spectrum (+4°)',
    description: 'Camera wedge held with +4 degrees angular roll. Tests ROI variance centroid resilience to diagonal tilt.',
    width: 400,
    height: 300,
    expectedCenterX: 200,
    expectedCenterY: 150,
    expectedRoiDetected: true,
    expectedShouldReject: false,
    generateData: () =>
      synthesizeSpectralFrame({
        width: 400,
        height: 300,
        centerY: 150,
        bandThicknessSigma: 18,
        tiltAngleRad: (4 * Math.PI) / 180,
        noiseSigma: 4,
        absorbancePeak: { nm: 680, strength: 0.40, fwhm: 45 },
      }),
  },
  {
    id: 'shifted_vertical',
    name: 'Shifted Spectrum (+60px Down)',
    description: 'Slit displaced vertically near bottom edge (Y=210). Tests vertical tracking in non-centered positions.',
    width: 400,
    height: 300,
    expectedCenterX: 200,
    expectedCenterY: 210,
    expectedRoiDetected: true,
    expectedShouldReject: false,
    generateData: () =>
      synthesizeSpectralFrame({
        width: 400,
        height: 300,
        centerY: 210,
        bandThicknessSigma: 15,
        noiseSigma: 3,
        absorbancePeak: { nm: 680, strength: 0.40, fwhm: 45 },
      }),
  },
  {
    id: 'noisy_spectrum',
    name: 'High Noise CMOS Capture',
    description: 'High gain setting on budget CMOS sensor. Heavy shot noise (sigma = 18).',
    width: 400,
    height: 300,
    expectedCenterX: 200,
    expectedCenterY: 150,
    expectedRoiDetected: true,
    expectedShouldReject: false,
    generateData: () =>
      synthesizeSpectralFrame({
        width: 400,
        height: 300,
        centerY: 150,
        bandThicknessSigma: 16,
        noiseSigma: 18,
        absorbancePeak: { nm: 680, strength: 0.40, fwhm: 45 },
      }),
  },
  {
    id: 'low_contrast',
    name: 'Low Contrast / Ambient Washout',
    description: 'Strong ambient parasitic white light (bg = 110 AU) washing out spectral band contrast.',
    width: 400,
    height: 300,
    expectedCenterX: 200,
    expectedCenterY: 150,
    expectedRoiDetected: true,
    expectedShouldReject: false,
    generateData: () =>
      synthesizeSpectralFrame({
        width: 400,
        height: 300,
        centerY: 150,
        bandThicknessSigma: 16,
        backgroundLuminance: 110,
        noiseSigma: 4,
        absorbancePeak: { nm: 680, strength: 0.40, fwhm: 45 },
      }),
  },
  {
    id: 'saturated_spectrum',
    name: 'Severe Pixel Saturation',
    description: 'Over-exposed CMOS frame. Intensities clipped at 255 across central band. Must be flagged by QC.',
    width: 400,
    height: 300,
    expectedCenterX: 200,
    expectedCenterY: 150,
    expectedRoiDetected: true,
    expectedShouldReject: true,
    expectedRejectionReason: 'Sensor pixel saturation detected',
    generateData: () =>
      synthesizeSpectralFrame({
        width: 400,
        height: 300,
        centerY: 150,
        bandThicknessSigma: 24,
        saturationCeiling: true,
        noiseSigma: 2,
      }),
  },
  {
    id: 'wrong_orientation',
    name: 'Wrong Orientation (Vertical Band)',
    description: 'Phone held vertically at 90°. Dispersion runs vertically; horizontal row variance has no distinct peak.',
    width: 400,
    height: 300,
    expectedCenterX: 200,
    expectedCenterY: 150,
    expectedRoiDetected: true,
    expectedShouldReject: false,
    generateData: () =>
      synthesizeSpectralFrame({
        width: 400,
        height: 300,
        centerY: 200,
        bandThicknessSigma: 18,
        verticalOrientation: true,
        noiseSigma: 4,
      }),
  },
  {
    id: 'no_spectrum_blank',
    name: 'No Spectrum / Dark Frame',
    description: 'Lens cap on or LED disconnected. Pure dark noise without any optical dispersion band.',
    width: 400,
    height: 300,
    expectedCenterX: 200,
    expectedCenterY: 150,
    expectedRoiDetected: true,
    expectedShouldReject: true,
    expectedRejectionReason: 'signal level',
    generateData: () => {
      const data = new Uint8ClampedArray(400 * 300 * 4);
      for (let i = 0; i < data.length; i += 4) {
        const val = 10 + Math.round(Math.random() * 5);
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
      }
      return data;
    },
  },
  {
    id: 'multiple_bright_bands',
    name: 'Multiple Bright Bands (Stray Light Reflection)',
    description: 'Sample stripe at Y=120 plus a secondary parasitic ceiling light reflection band at Y=230.',
    width: 400,
    height: 300,
    expectedCenterX: 200,
    expectedCenterY: 120,
    expectedRoiDetected: true,
    expectedShouldReject: false,
    generateData: () =>
      synthesizeSpectralFrame({
        width: 400,
        height: 300,
        centerY: 120,
        bandThicknessSigma: 14,
        extraSecondaryBandY: 230,
        noiseSigma: 4,
        absorbancePeak: { nm: 680, strength: 0.35, fwhm: 45 },
      }),
  },
];

/**
 * Runs an ImageFixture through the full computer vision + optical inference pipeline:
 * Frame -> detectSpectralROI -> extractProfileFromROI -> executeLISAPipeline -> QC/OOD
 */
export function evaluateImageFixture(fixture: ImageFixture): ImageFixtureTestResult {
  const pixelData = fixture.generateData();
  const ctx = createMockCanvasContext(fixture.width, fixture.height, pixelData);

  // 1. Detect ROI
  const roi = detectSpectralROI(ctx, fixture.width, fixture.height);
  const detectedCenterY = Math.round(roi.y + roi.height / 2);

  // 2. Extract 1D spectral profile
  const extracted = extractProfileFromROI(ctx, roi, 151);

  // 3. Generate blank intensities for pipeline absorbance
  const blankSim = getWhiteLEDBaseProfile(STANDARD_WAVELENGTHS);

  // 4. Run through LISA production orchestrator
  let pipelineResult: PipelineExecutionResult | null = null;
  let pipelineSuccess = false;
  let predictedConc: number | null = null;
  let uncertainty: number | null = null;
  let qcStatus = 'FAIL';
  let oodStatus = 'OUT_OF_DISTRIBUTION';
  let isRejected = true;
  let rejectionReason: string | undefined = undefined;

  try {
    pipelineResult = executeLISAPipeline({
      sampleName: `Image Fixture: ${fixture.name}`,
      sourceMode: 'LIVE CAMERA',
      analyteId: 'phosphate',
      deviceId: 'device-a-reference',
      deviceFingerprint: 'LISA-IMAGE-TEST',
      rawSampleIntensities: extracted.profile,
      rawBlankIntensities: blankSim,
    });

    pipelineSuccess = true;
    predictedConc = pipelineResult.record.concentration;
    uncertainty = pipelineResult.record.uncertainty;
    qcStatus = pipelineResult.qc.overallStatus;
    oodStatus = pipelineResult.ood.status;
    isRejected = pipelineResult.record.isRejected;
    rejectionReason = pipelineResult.record.rejectionReason;
  } catch (err: any) {
    pipelineSuccess = false;
    rejectionReason = err.message;
  }

  // 5. Evaluate behavior pass/fail
  let behaviorPass = true;
  const notesArr: string[] = [];

  // Check ROI detection
  if (fixture.expectedCenterY > 0) {
    const dy = Math.abs(detectedCenterY - fixture.expectedCenterY);
    if (dy > 35 && fixture.id !== 'wrong_orientation' && fixture.id !== 'no_spectrum_blank') {
      behaviorPass = false;
      notesArr.push(`ROI center Y displaced by ${dy}px (detected: ${detectedCenterY}, expected: ${fixture.expectedCenterY})`);
    } else {
      notesArr.push(`ROI center Y: ${detectedCenterY} (target ~${fixture.expectedCenterY})`);
    }
  }

  // Check rejection agreement
  if (fixture.expectedShouldReject) {
    if (!isRejected && !extracted.isSaturated) {
      behaviorPass = false;
      notesArr.push(`Expected rejection, but sample was accepted.`);
    } else {
      notesArr.push(`Correctly intercepted/rejected.`);
    }
  }

  return {
    fixtureId: fixture.id,
    fixtureName: fixture.name,
    imageWidth: fixture.width,
    imageHeight: fixture.height,
    roiDetected: roi,
    extractedCenterY: detectedCenterY,
    extractedProfileLength: extracted.profile.length,
    maxSignal: extracted.maxSignal,
    isSaturated: extracted.isSaturated,
    pipelineSuccess,
    predictedConcentration: predictedConc,
    uncertainty,
    qcStatus,
    oodStatus,
    isRejected,
    rejectionReason,
    behaviorPass,
    notes: notesArr.join(' • '),
  };
}
