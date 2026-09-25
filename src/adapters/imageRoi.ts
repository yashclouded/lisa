// LISA: Image Spectrum Extraction & Computer Vision ROI Processor
// Extracts horizontal dispersed spectral band from camera images via spatial binning

export interface ROIBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedImageSpectrum {
  profile: number[];
  roi: ROIBox;
  imageWidth: number;
  imageHeight: number;
  maxSignal: number;
  isSaturated: boolean;
}

/**
 * Computes center of mass of the top percentile of variance rows.
 * Replaces naive single-row max variance which latches onto sharp frame edges.
 */
export function computeVarianceCentroid(
  rowVariances: Float32Array | number[],
  height: number,
  topPercentile: number = 0.20
): number {
  if (height <= 0) return 0;
  const margin = Math.max(1, Math.min(10, Math.floor(height * 0.02)));
  const candidateRows: { y: number; variance: number }[] = [];

  for (let y = margin; y < height - margin; y++) {
    const v = rowVariances[y] || 0;
    candidateRows.push({ y, variance: isFinite(v) && v > 0 ? v : 0 });
  }

  if (candidateRows.length === 0) {
    return Math.floor(height / 2);
  }

  // Sort descending by variance
  const sorted = [...candidateRows].sort((a, b) => b.variance - a.variance);

  // Take top N% rows (minimum 1 row)
  const topCount = Math.max(1, Math.ceil(sorted.length * topPercentile));
  const topRows = sorted.slice(0, topCount);

  let weightSum = 0;
  let weightedYSum = 0;

  for (const item of topRows) {
    if (item.variance > 0) {
      weightSum += item.variance;
      weightedYSum += item.y * item.variance;
    }
  }

  if (weightSum <= 0) {
    return Math.floor(height / 2);
  }

  return Math.round(weightedYSum / weightSum);
}

// Automatically detect horizontal spectrum stripe using row-wise variance centroid
export function detectSpectralROI(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): ROIBox {
  if (width <= 0 || height <= 0) {
    return { x: 0, y: 0, width: Math.max(10, width), height: Math.max(10, height) };
  }

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Calculate intensity variance along each horizontal row
  const rowVariances = new Float32Array(height);

  for (let y = 0; y < height; y++) {
    let sum = 0;
    let sumSq = 0;
    const rowOffset = y * width * 4;

    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x * 4;
      // Perceived luminance
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      sum += lum;
      sumSq += lum * lum;
    }

    const mean = sum / width;
    const variance = sumSq / width - mean * mean;
    rowVariances[y] = variance;
  }

  // BUG-010: Use center-of-mass of top 20% variance rows rather than single max variance row
  const bestCenterY = computeVarianceCentroid(rowVariances, height, 0.20);

  // Standard ROI: horizontal span 85% of width, height ~18% of frame
  const roiHeight = Math.max(30, Math.min(height, Math.round(height * 0.18)));
  const roiWidth = Math.max(100, Math.min(width, Math.round(width * 0.85)));
  const roiX = Math.max(0, Math.min(width - roiWidth, Math.round((width - roiWidth) / 2)));
  const roiY = Math.max(0, Math.min(height - roiHeight, Math.round(bestCenterY - roiHeight / 2)));

  return {
    x: roiX,
    y: roiY,
    width: roiWidth,
    height: roiHeight,
  };
}

// Column-wise spatial averaging within the ROI to produce a 1D transmission profile
export function extractProfileFromROI(
  ctx: CanvasRenderingContext2D,
  roi: ROIBox,
  targetLength: number = 151
): ExtractedImageSpectrum {
  const imgData = ctx.getImageData(roi.x, roi.y, roi.width, roi.height);
  const data = imgData.data;

  const rawColumns = new Float32Array(roi.width);
  let maxSignal = 0;
  let saturatedCount = 0;

  for (let col = 0; col < roi.width; col++) {
    let colSum = 0;
    for (let row = 0; row < roi.height; row++) {
      const idx = (row * roi.width + col) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (r >= 252 || g >= 252 || b >= 252) {
        saturatedCount++;
      }
      colSum += lum;
    }

    const colMean = colSum / roi.height;
    rawColumns[col] = colMean;
    if (colMean > maxSignal) {
      maxSignal = colMean;
    }
  }

  // Resample raw column profile to targetLength (151 points)
  const profile: number[] = [];
  for (let i = 0; i < targetLength; i++) {
    const normX = (i / (targetLength - 1)) * (roi.width - 1);
    const x0 = Math.floor(normX);
    const x1 = Math.min(roi.width - 1, x0 + 1);
    const frac = normX - x0;
    const val = rawColumns[x0] * (1 - frac) + rawColumns[x1] * frac;
    profile.push(Math.round(val * 10) / 10);
  }

  return {
    profile,
    roi,
    imageWidth: ctx.canvas.width,
    imageHeight: ctx.canvas.height,
    maxSignal,
    isSaturated: saturatedCount > roi.width * 0.15 || maxSignal >= 250,
  };
}
