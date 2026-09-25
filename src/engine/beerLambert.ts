// LISA: Model A — Classical Beer-Lambert Band Model
// Implements univariate linear regression on integrated peak absorbance

import { ModelMetrics } from '../types';
import { integrateBandAbsorbance } from './absorbance';

export interface BeerLambertFit {
  isValid: boolean;
  errorCode?: string;
  slope: number;       // k (AU / [mg/L])
  intercept: number;   // b (AU)
  r2: number | null;
  rmse: number | null; // in Absorbance Units (AU)
  rmseUnit?: string;   // 'AU'
  concentrationRmse: number | null; // in concentration units (mg/L) = rmse / slope
  loocvRmse: number | null; // in concentration units (mg/L)
  lod: number | null;         // Limit of Detection (3.3 * s_yx / k) in mg/L
  loq: number | null;         // Limit of Quantitation (10 * s_yx / k) in mg/L
  syx: number | null;         // Residual standard error in AU
  standards: { concentration: number; measuredAbsorbance: number; fittedAbsorbance: number }[];
}

export function fitBeerLambertModel(
  standards: { concentration: number; absorbances: number[]; wavelengths: number[] }[],
  bandStartNm: number = 630,
  bandEndNm: number = 690
): BeerLambertFit {
  const n = standards.length;
  if (n < 2) {
    return {
      isValid: false,
      errorCode: 'INSUFFICIENT_CALIBRATION_POINTS',
      slope: 0,
      intercept: 0,
      r2: null,
      rmse: null,
      concentrationRmse: null,
      loocvRmse: null,
      lod: null,
      loq: null,
      syx: null,
      standards: [],
    };
  }

  const dataPoints = standards.map((s) => ({
    c: s.concentration,
    a: integrateBandAbsorbance(s.wavelengths, s.absorbances, bandStartNm, bandEndNm),
  }));

  // Linear Regression: A = k * C + b
  let sumC = 0;
  let sumA = 0;
  let sumCA = 0;
  let sumCC = 0;

  for (const pt of dataPoints) {
    sumC += pt.c;
    sumA += pt.a;
    sumCA += pt.c * pt.a;
    sumCC += pt.c * pt.c;
  }

  const denom = n * sumCC - sumC * sumC;
  if (Math.abs(denom) < 1e-12) {
    return {
      isValid: false,
      errorCode: 'DEGENERATE_CALIBRATION_POINTS',
      slope: 0,
      intercept: 0,
      r2: null,
      rmse: null,
      concentrationRmse: null,
      loocvRmse: null,
      lod: null,
      loq: null,
      syx: null,
      standards: [],
    };
  }

  const slope = (n * sumCA - sumC * sumA) / denom;
  const intercept = (sumA - slope * sumC) / n;

  // Compute R2, RMSE (AU), s_y/x
  const meanA = sumA / n;
  let ssTot = 0;
  let ssRes = 0;

  const fittedStandards = dataPoints.map((pt) => {
    const fitted = slope * pt.c + intercept;
    const residual = pt.a - fitted;
    ssTot += Math.pow(pt.a - meanA, 2);
    ssRes += Math.pow(residual, 2);
    return {
      concentration: pt.c,
      measuredAbsorbance: parseFloat(pt.a.toFixed(4)),
      fittedAbsorbance: parseFloat(fitted.toFixed(4)),
    };
  });

  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : (ssRes === 0 ? 1.0 : null);
  const rmse = Math.sqrt(ssRes / n);
  const concentrationRmse = slope > 0 ? rmse / slope : null;
  const degreesOfFreedom = Math.max(1, n - 2);
  const syx = Math.sqrt(ssRes / degreesOfFreedom);

  // Analytical LOD & LOQ: LOD = 3.3 * syx / k, LOQ = 10 * syx / k (mg/L)
  const lod = slope > 0 ? (3.3 * syx) / slope : null;
  const loq = slope > 0 ? (10.0 * syx) / slope : null;

  // Leave-One-Out Cross-Validation (LOOCV) for Beer-Lambert (in concentration space mg/L)
  let loocvSqErrSum = 0;
  for (let i = 0; i < n; i++) {
    // Fit without point i
    let subSumC = 0;
    let subSumA = 0;
    let subSumCA = 0;
    let subSumCC = 0;
    const subN = n - 1;

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      subSumC += dataPoints[j].c;
      subSumA += dataPoints[j].a;
      subSumCA += dataPoints[j].c * dataPoints[j].a;
      subSumCC += dataPoints[j].c * dataPoints[j].c;
    }

    const subDenom = subN * subSumCC - subSumC * subSumC;
    const subSlope = Math.abs(subDenom) > 1e-12 ? (subN * subSumCA - subSumC * subSumA) / subDenom : slope;
    const subIntercept = (subSumA - subSlope * subSumC) / subN;

    // Predict omitted point concentration: C_pred = (A - b) / k
    const predC = Math.abs(subSlope) > 1e-12 ? (dataPoints[i].a - subIntercept) / subSlope : 0;
    loocvSqErrSum += Math.pow(predC - dataPoints[i].c, 2);
  }
  const loocvRmse = Math.sqrt(loocvSqErrSum / n);

  return {
    isValid: true,
    slope: parseFloat(slope.toFixed(4)),
    intercept: parseFloat(intercept.toFixed(4)),
    r2: r2 !== null ? parseFloat(r2.toFixed(4)) : null,
    rmse: parseFloat(rmse.toFixed(4)),
    rmseUnit: 'AU',
    concentrationRmse: concentrationRmse !== null ? parseFloat(concentrationRmse.toFixed(4)) : null,
    loocvRmse: parseFloat(loocvRmse.toFixed(4)),
    lod: lod !== null ? parseFloat(lod.toFixed(4)) : null,
    loq: loq !== null ? parseFloat(loq.toFixed(4)) : null,
    syx: parseFloat(syx.toFixed(4)),
    standards: fittedStandards,
  };
}

export function predictBeerLambert(
  wavelengths: number[],
  absorbances: number[],
  fit: BeerLambertFit,
  bandStartNm: number = 630,
  bandEndNm: number = 690
): { concentration: number; bandAbsorbance: number; metrics: ModelMetrics } {
  const bandAbsorbance = integrateBandAbsorbance(wavelengths, absorbances, bandStartNm, bandEndNm);

  if (!fit.isValid || Math.abs(fit.slope) < 1e-12) {
    return {
      concentration: NaN,
      bandAbsorbance,
      metrics: {
        name: 'Beer-Lambert (Peak Band)',
        type: 'beer-lambert',
        r2: null,
        rmse: null,
        rmseUnit: 'AU',
        concentrationRmse: null,
        loocvRmse: null,
        lod: null,
        loq: null,
        equationOrParams: 'Invalid Beer-Lambert calibration model',
      },
    };
  }

  // c = (A - b) / k
  const rawConc = (bandAbsorbance - fit.intercept) / fit.slope;
  const concentration = Math.max(0, rawConc);

  return {
    concentration,
    bandAbsorbance,
    metrics: {
      name: 'Beer-Lambert (Peak Band)',
      type: 'beer-lambert',
      r2: fit.r2,
      rmse: fit.rmse,
      rmseUnit: 'AU',
      concentrationRmse: fit.concentrationRmse,
      loocvRmse: fit.loocvRmse,
      lod: fit.lod,
      loq: fit.loq,
      equationOrParams: `A(${bandStartNm}-${bandEndNm}nm) = ${fit.slope} × C + ${fit.intercept}`,
    },
  };
}
