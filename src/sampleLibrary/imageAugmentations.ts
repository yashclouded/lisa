// LISA: Image Augmentation Test Suite
// Applies realistic optical and sensor perturbations to spectral frames
// and measures computer vision & inference robustness.

import { createMockCanvasContext, synthesizeSpectralFrame } from './imageFixtures';
import { detectSpectralROI, extractProfileFromROI } from '../adapters/imageRoi';
import { executeLISAPipeline } from '../engine/orchestrator';
import { getWhiteLEDBaseProfile } from '../engine/simulator';
import { STANDARD_WAVELENGTHS } from '../engine/spectrum';

export type AugmentationType =
  | 'identity'
  | 'brightness_up'
  | 'brightness_down'
  | 'contrast_up'
  | 'contrast_down'
  | 'gaussian_noise'
  | 'vertical_translate'
  | 'horizontal_translate'
  | 'blur_box'
  | 'quantization';

export interface AugmentationResult {
  type: AugmentationType;
  description: string;
  roiCenterY: number;
  maxSignal: number;
  isSaturated: boolean;
  predictedConcentration: number | null;
  uncertainty: number | null;
  qcStatus: string;
  oodStatus: string;
  isRejected: boolean;
  deltaFromBaselineMgL: number | null;
}

/**
 * Transforms an RGBA buffer in-place or via copied buffer.
 */
export function applyImageTransform(
  srcData: Uint8ClampedArray,
  width: number,
  height: number,
  type: AugmentationType
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(srcData.length);

  switch (type) {
    case 'identity':
      dst.set(srcData);
      break;

    case 'brightness_up':
      for (let i = 0; i < srcData.length; i += 4) {
        dst[i] = Math.min(255, srcData[i] + 40);
        dst[i + 1] = Math.min(255, srcData[i + 1] + 40);
        dst[i + 2] = Math.min(255, srcData[i + 2] + 40);
        dst[i + 3] = srcData[i + 3];
      }
      break;

    case 'brightness_down':
      for (let i = 0; i < srcData.length; i += 4) {
        dst[i] = Math.max(0, srcData[i] - 40);
        dst[i + 1] = Math.max(0, srcData[i + 1] - 40);
        dst[i + 2] = Math.max(0, srcData[i + 2] - 40);
        dst[i + 3] = srcData[i + 3];
      }
      break;

    case 'contrast_up':
      // Scale around midpoint 128
      for (let i = 0; i < srcData.length; i += 4) {
        dst[i] = Math.min(255, Math.max(0, Math.round(128 + 1.4 * (srcData[i] - 128))));
        dst[i + 1] = Math.min(255, Math.max(0, Math.round(128 + 1.4 * (srcData[i + 1] - 128))));
        dst[i + 2] = Math.min(255, Math.max(0, Math.round(128 + 1.4 * (srcData[i + 2] - 128))));
        dst[i + 3] = srcData[i + 3];
      }
      break;

    case 'contrast_down':
      for (let i = 0; i < srcData.length; i += 4) {
        dst[i] = Math.min(255, Math.max(0, Math.round(128 + 0.6 * (srcData[i] - 128))));
        dst[i + 1] = Math.min(255, Math.max(0, Math.round(128 + 0.6 * (srcData[i + 1] - 128))));
        dst[i + 2] = Math.min(255, Math.max(0, Math.round(128 + 0.6 * (srcData[i + 2] - 128))));
        dst[i + 3] = srcData[i + 3];
      }
      break;

    case 'gaussian_noise':
      for (let i = 0; i < srcData.length; i += 4) {
        const n = (Math.random() + Math.random() - 1) * 25;
        dst[i] = Math.min(255, Math.max(0, Math.round(srcData[i] + n)));
        dst[i + 1] = Math.min(255, Math.max(0, Math.round(srcData[i + 1] + n)));
        dst[i + 2] = Math.min(255, Math.max(0, Math.round(srcData[i + 2] + n)));
        dst[i + 3] = srcData[i + 3];
      }
      break;

    case 'vertical_translate':
      // Shift down by 25 pixels
      const dy = 25;
      for (let y = 0; y < height; y++) {
        const srcY = y - dy;
        for (let x = 0; x < width; x++) {
          const dstIdx = (y * width + x) * 4;
          if (srcY >= 0 && srcY < height) {
            const srcIdx = (srcY * width + x) * 4;
            dst[dstIdx] = srcData[srcIdx];
            dst[dstIdx + 1] = srcData[srcIdx + 1];
            dst[dstIdx + 2] = srcData[srcIdx + 2];
            dst[dstIdx + 3] = srcData[srcIdx + 3];
          } else {
            dst[dstIdx] = 15;
            dst[dstIdx + 1] = 15;
            dst[dstIdx + 2] = 15;
            dst[dstIdx + 3] = 255;
          }
        }
      }
      break;

    case 'horizontal_translate':
      // Shift right by 30 pixels
      const dx = 30;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dstIdx = (y * width + x) * 4;
          const srcX = x - dx;
          if (srcX >= 0 && srcX < width) {
            const srcIdx = (y * width + srcX) * 4;
            dst[dstIdx] = srcData[srcIdx];
            dst[dstIdx + 1] = srcData[srcIdx + 1];
            dst[dstIdx + 2] = srcData[srcIdx + 2];
            dst[dstIdx + 3] = srcData[srcIdx + 3];
          } else {
            dst[dstIdx] = 15;
            dst[dstIdx + 1] = 15;
            dst[dstIdx + 2] = 15;
            dst[dstIdx + 3] = 255;
          }
        }
      }
      break;

    case 'blur_box':
      // 3x3 box blur
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let sumR = 0;
          let sumG = 0;
          let sumB = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * width + (x + kx)) * 4;
              sumR += srcData[idx];
              sumG += srcData[idx + 1];
              sumB += srcData[idx + 2];
            }
          }
          const dstIdx = (y * width + x) * 4;
          dst[dstIdx] = Math.round(sumR / 9);
          dst[dstIdx + 1] = Math.round(sumG / 9);
          dst[dstIdx + 2] = Math.round(sumB / 9);
          dst[dstIdx + 3] = 255;
        }
      }
      break;

    case 'quantization':
      // 4-bit posterization (step of 16)
      for (let i = 0; i < srcData.length; i += 4) {
        dst[i] = Math.floor(srcData[i] / 16) * 16;
        dst[i + 1] = Math.floor(srcData[i + 1] / 16) * 16;
        dst[i + 2] = Math.floor(srcData[i + 2] / 16) * 16;
        dst[i + 3] = srcData[i + 3];
      }
      break;
  }

  return dst;
}

export function runAugmentationStressTest(): {
  baselineConcentration: number | null;
  results: AugmentationResult[];
} {
  const width = 400;
  const height = 300;
  const baseFrame = synthesizeSpectralFrame({
    width,
    height,
    centerY: 150,
    bandThicknessSigma: 16,
    noiseSigma: 3,
    absorbancePeak: { nm: 680, strength: 0.40, fwhm: 45 },
  });

  const blankSim = getWhiteLEDBaseProfile(STANDARD_WAVELENGTHS);
  const transforms: { type: AugmentationType; desc: string }[] = [
    { type: 'identity', desc: 'Original Clean Optical Frame' },
    { type: 'brightness_up', desc: 'Brightness Boost (+40 AU)' },
    { type: 'brightness_down', desc: 'Brightness Reduction (-40 AU)' },
    { type: 'contrast_up', desc: 'Contrast Enhancement (1.4x)' },
    { type: 'contrast_down', desc: 'Contrast Attenuation (0.6x)' },
    { type: 'gaussian_noise', desc: 'Additive Gaussian Sensor Noise (sigma=25)' },
    { type: 'vertical_translate', desc: 'Vertical Shift (+25 px)' },
    { type: 'horizontal_translate', desc: 'Horizontal Shift (+30 px)' },
    { type: 'blur_box', desc: 'Spatial Blur (3x3 Box Kernel)' },
    { type: 'quantization', desc: '4-Bit Posterization / Compression' },
  ];

  let baselineConc: number | null = null;
  const results: AugmentationResult[] = [];

  for (const t of transforms) {
    const transformedData = applyImageTransform(baseFrame, width, height, t.type);
    const ctx = createMockCanvasContext(width, height, transformedData);

    const roi = detectSpectralROI(ctx, width, height);
    const extracted = extractProfileFromROI(ctx, roi, 151);

    const pipelineResult = executeLISAPipeline({
      sampleName: `Augmentation: ${t.type}`,
      sourceMode: 'LIVE CAMERA',
      analyteId: 'phosphate',
      deviceId: 'device-a-reference',
      deviceFingerprint: 'LISA-AUG-TEST',
      rawSampleIntensities: extracted.profile,
      rawBlankIntensities: blankSim,
    });

    const conc = pipelineResult.record.concentration;
    if (t.type === 'identity') {
      baselineConc = conc;
    }

    const delta =
      conc !== null && baselineConc !== null ? Math.round(Math.abs(conc - baselineConc) * 1000) / 1000 : null;

    results.push({
      type: t.type,
      description: t.desc,
      roiCenterY: Math.round(roi.y + roi.height / 2),
      maxSignal: extracted.maxSignal,
      isSaturated: extracted.isSaturated,
      predictedConcentration: conc !== null ? Math.round(conc * 1000) / 1000 : null,
      uncertainty: pipelineResult.record.uncertainty !== null ? Math.round(pipelineResult.record.uncertainty * 1000) / 1000 : null,
      qcStatus: pipelineResult.qc.overallStatus,
      oodStatus: pipelineResult.ood.status,
      isRejected: pipelineResult.record.isRejected,
      deltaFromBaselineMgL: delta,
    });
  }

  return {
    baselineConcentration: baselineConc,
    results,
  };
}
