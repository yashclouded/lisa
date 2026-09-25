// LISA: Security & Robustness Fuzzing Suite
// Tests pipeline immunity against malformed inputs: NaN, Infinity, negative values,
// empty arrays, corrupted pixel buffers, and missing scenario metadata.

import { executeLISAPipeline } from '../engine/orchestrator';
import { detectSpectralROI } from '../adapters/imageRoi';
import { createMockCanvasContext } from './imageFixtures';

export interface RobustnessTestResult {
  testName: string;
  category: 'nan_infinity' | 'negative_values' | 'corrupt_buffer' | 'empty_arrays' | 'malformed_metadata';
  passed: boolean;
  handledGracefully: boolean;
  message: string;
  error?: string;
}

export function runRobustnessTestSuite(): {
  totalTests: number;
  passedCount: number;
  failedCount: number;
  results: RobustnessTestResult[];
} {
  const results: RobustnessTestResult[] = [];

  // Helper to record test
  const runTest = (
    testName: string,
    category: RobustnessTestResult['category'],
    fn: () => void
  ) => {
    try {
      fn();
      results.push({
        testName,
        category,
        passed: true,
        handledGracefully: true,
        message: 'Handled safely without uncaught exception.',
      });
    } catch (err: any) {
      results.push({
        testName,
        category,
        passed: false,
        handledGracefully: false,
        message: `Threw unexpected uncaught exception: ${err.message}`,
        error: err.stack,
      });
    }
  };

  // 1. NaN and Infinity in optical intensity arrays
  runTest('Pipeline handles NaN sample intensities', 'nan_infinity', () => {
    const raw = new Array(151).fill(120);
    raw[25] = NaN;
    raw[75] = NaN;
    const res = executeLISAPipeline({
      sampleName: 'NaN Fuzz',
      sourceMode: 'SIMULATED',
      analyteId: 'phosphate',
      deviceId: 'device-a-reference',
      deviceFingerprint: 'FUZZ',
      rawSampleIntensities: raw,
      rawBlankIntensities: new Array(151).fill(200),
    });
    // Should either reject or clean up NaNs, never crash
    if (res.record.concentration !== null) {
      if (isNaN(res.record.concentration)) throw new Error('Reported NaN concentration to user!');
    }
  });

  runTest('Pipeline handles Infinity sample intensities', 'nan_infinity', () => {
    const raw = new Array(151).fill(120);
    raw[50] = Infinity;
    raw[51] = -Infinity;
    const res = executeLISAPipeline({
      sampleName: 'Infinity Fuzz',
      sourceMode: 'SIMULATED',
      analyteId: 'phosphate',
      deviceId: 'device-a-reference',
      deviceFingerprint: 'FUZZ',
      rawSampleIntensities: raw,
      rawBlankIntensities: new Array(151).fill(200),
    });
    if (res.record.concentration !== null && !isFinite(res.record.concentration)) {
      throw new Error('Reported infinite concentration to user!');
    }
  });

  // 2. Negative intensity values
  runTest('Pipeline handles negative photodiode intensities', 'negative_values', () => {
    const raw = new Array(151).fill(100);
    raw[10] = -50;
    raw[20] = -120;
    const res = executeLISAPipeline({
      sampleName: 'Negative Fuzz',
      sourceMode: 'SIMULATED',
      analyteId: 'phosphate',
      deviceId: 'device-a-reference',
      deviceFingerprint: 'FUZZ',
      rawSampleIntensities: raw,
      rawBlankIntensities: new Array(151).fill(200),
    });
    if (res.record.concentration !== null && res.record.concentration < 0) {
      // Negative concentrations should be clamped or rejected
      throw new Error(`Negative concentration reported: ${res.record.concentration}`);
    }
  });

  // 3. Zero / Empty arrays
  runTest('Pipeline handles all-zero blank intensities', 'empty_arrays', () => {
    const raw = new Array(151).fill(100);
    const blank = new Array(151).fill(0);
    const res = executeLISAPipeline({
      sampleName: 'Zero Blank Fuzz',
      sourceMode: 'SIMULATED',
      analyteId: 'phosphate',
      deviceId: 'device-a-reference',
      deviceFingerprint: 'FUZZ',
      rawSampleIntensities: raw,
      rawBlankIntensities: blank,
    });
    // Division by zero in absorbance -log10(I/I0) must be handled safely
    if (res.record.concentration !== null && !isFinite(res.record.concentration)) {
      throw new Error('Produced non-finite number with zero blank!');
    }
  });

  // 4. Corrupt / 1x1 image canvas
  runTest('CV ROI detector handles 1x1 pixel image', 'corrupt_buffer', () => {
    const buf = new Uint8ClampedArray([255, 0, 0, 255]);
    const ctx = createMockCanvasContext(1, 1, buf);
    const roi = detectSpectralROI(ctx, 1, 1);
    if (!roi || roi.width <= 0 || roi.height <= 0) {
      throw new Error('Failed to return valid bounded ROI for 1x1');
    }
  });

  // 5. Extremely large dimensions
  runTest('CV ROI detector handles degenerate 0x0 frame', 'corrupt_buffer', () => {
    const buf = new Uint8ClampedArray(0);
    const ctx = createMockCanvasContext(0, 0, buf);
    const roi = detectSpectralROI(ctx, 0, 0);
    if (!roi) throw new Error('Crashed on 0x0 frame');
  });

  // 6. Unknown device profile ID
  runTest('Pipeline handles completely unknown device ID', 'malformed_metadata', () => {
    const res = executeLISAPipeline({
      sampleName: 'Unknown Device Fuzz',
      sourceMode: 'SIMULATED',
      analyteId: 'phosphate',
      deviceId: 'non-existent-device-xyz-999',
      deviceFingerprint: 'UNKNOWN-FINGERPRINT',
      rawSampleIntensities: new Array(151).fill(120),
      rawBlankIntensities: new Array(151).fill(200),
    });
    // Should fall back to default profile gracefully
    if (!res || !res.record) throw new Error('Failed to execute with unknown device profile');
  });

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  return {
    totalTests: results.length,
    passedCount,
    failedCount,
    results,
  };
}
