// LISA: Optical Baseline Correction
// Conservative baseline subtraction using rolling minimum or linear background fit

export function estimateRollingBaseline(absorbances: number[], windowSize: number = 21): number[] {
  const half = Math.floor(windowSize / 2);
  const baseline: number[] = [];

  for (let i = 0; i < absorbances.length; i++) {
    let minVal = Infinity;
    for (let j = -half; j <= half; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < absorbances.length) {
        if (absorbances[idx] < minVal) {
          minVal = absorbances[idx];
        }
      }
    }
    baseline.push(Number.isFinite(minVal) ? minVal : 0);
  }

  // Smooth the baseline
  const smoothedBaseline: number[] = [];
  const smoothHalf = 5;
  for (let i = 0; i < baseline.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = -smoothHalf; j <= smoothHalf; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < baseline.length) {
        sum += baseline[idx];
        count++;
      }
    }
    smoothedBaseline.push(sum / count);
  }

  return smoothedBaseline;
}

export function correctBaseline(
  absorbances: number[],
  baselineMode: 'none' | 'rolling-min' | 'offset-zero' = 'offset-zero'
): { corrected: number[]; baseline: number[] } {
  if (baselineMode === 'none') {
    return { corrected: [...absorbances], baseline: new Array(absorbances.length).fill(0) };
  }

  if (baselineMode === 'offset-zero') {
    // Offset by minimum non-negative baseline point in non-absorbing region (400-450 nm)
    const nonAbsorbRegion = absorbances.slice(0, 25);
    const minVal = Math.min(...nonAbsorbRegion);
    const offset = Math.max(0, minVal);
    const corrected = absorbances.map((a) => Math.max(0, a - offset));
    const baseline = new Array(absorbances.length).fill(offset);
    return { corrected, baseline };
  }

  const baseline = estimateRollingBaseline(absorbances);
  const corrected = absorbances.map((a, i) => Math.max(0, a - baseline[i]));
  return { corrected, baseline };
}
