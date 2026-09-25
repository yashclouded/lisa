// LISA: Model B — Full-Spectrum L2-Regularized Ridge Regression
// Multivariate regression across all 151 spectral wavelengths (400-700 nm @ 2 nm)

import { ModelMetrics } from '../types';

export interface RidgeModel {
  weights: number[];      // w_1 ... w_151 (coefficients across spectrum)
  intercept: number;      // w_0
  alpha: number;          // regularization penalty parameter
  meanX: number[];        // feature centering means
  meanY: number;          // target centering mean
  r2: number | null;
  rmse: number | null;
  mae: number | null;
  loocvRmse: number;      // set to groupedCvRmse for backward compatibility
  groupedCvRmse: number;  // True Leave-One-Concentration-Out CV RMSE (no replicate leakage)
  groupedCvMae: number;   // True Leave-One-Concentration-Out CV MAE
  groupedCvR2: number | null; // True Leave-One-Concentration-Out CV R²
  cvGroupsCount: number;
  cvPredictionsCount: number;
  standardsCount: number;
}

// Solves A * x = b for an N x N positive definite / symmetric system using Gaussian elimination with partial pivoting
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    // Pivot selection
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }
    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;

    // Singular check
    if (Math.abs(M[i][i]) < 1e-12) {
      M[i][i] = 1e-12;
    }

    // Eliminate below
    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) {
        M[k][j] -= factor * M[i][j];
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = sum / M[i][i];
  }

  return x;
}

export function fitRidgeRegression(
  X: number[][],        // N standards x P features (151 wavelengths)
  y: number[],          // N concentrations
  alpha: number = 0.05, // Regularization parameter
  computeCv: boolean = true,
  groups?: (string | number)[]
): RidgeModel {
  const n = X.length;
  const p = X[0]?.length || 0;

  if (n < 2 || p === 0) {
    return {
      weights: new Array(p).fill(0),
      intercept: 0,
      alpha,
      meanX: new Array(p).fill(0),
      meanY: 0,
      r2: null,
      rmse: null,
      mae: null,
      loocvRmse: 0,
      groupedCvRmse: 0,
      groupedCvMae: 0,
      groupedCvR2: null,
      cvGroupsCount: 0,
      cvPredictionsCount: 0,
      standardsCount: n,
    };
  }

  // Feature and target centering
  const meanX = new Array(p).fill(0);
  let meanY = 0;
  for (let i = 0; i < n; i++) {
    meanY += y[i];
    for (let j = 0; j < p; j++) {
      meanX[j] += X[i][j];
    }
  }
  meanY /= n;
  for (let j = 0; j < p; j++) {
    meanX[j] /= n;
  }

  const Xc: number[][] = [];
  const yc: number[] = [];
  for (let i = 0; i < n; i++) {
    yc.push(y[i] - meanY);
    const row: number[] = [];
    for (let j = 0; j < p; j++) {
      row.push(X[i][j] - meanX[j]);
    }
    Xc.push(row);
  }

  // Dual-space formulation: (K + alpha * I) * beta = yc, where K = Xc * Xc^T is N x N
  // Primal weights: w = Xc^T * beta
  const K: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      let dot = 0;
      for (let k = 0; k < p; k++) {
        dot += Xc[i][k] * Xc[j][k];
      }
      if (i === j) {
        dot += alpha;
      }
      row.push(dot);
    }
    K.push(row);
  }

  const beta = solveLinearSystem(K, yc);

  // Compute primal weights w: length p
  const weights: number[] = new Array(p).fill(0);
  for (let j = 0; j < p; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += Xc[i][j] * beta[i];
    }
    weights[j] = sum;
  }

  // Compute w0 (intercept) = meanY - sum(weights * meanX)
  let w0 = meanY;
  for (let j = 0; j < p; j++) {
    w0 -= weights[j] * meanX[j];
  }

  // Evaluate training metrics
  let ssTot = 0;
  let ssRes = 0;
  let absErrSum = 0;

  for (let i = 0; i < n; i++) {
    let pred = w0;
    for (let j = 0; j < p; j++) {
      pred += weights[j] * X[i][j];
    }
    const err = y[i] - pred;
    ssTot += Math.pow(y[i] - meanY, 2);
    ssRes += Math.pow(err, 2);
    absErrSum += Math.abs(err);
  }

  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : (ssRes === 0 ? 1.0 : null);
  const rmse = Math.sqrt(ssRes / n);
  const mae = absErrSum / n;

  // Grouped Cross-Validation (Leave-One-Concentration-Out CV)
  // Ensures ALL replicates of the held-out concentration are excluded from training fold.
  let groupedCvRmse = rmse;
  let groupedCvMae = mae;
  let groupedCvR2: number | null = r2;
  let uniqueGroupsCount = 1;
  let predictionsCount = 0;

  if (computeCv && n > 2) {
    const sampleGroups = groups ? groups.map(String) : y.map((val) => val.toFixed(6));
    const uniqueGroups = Array.from(new Set(sampleGroups));
    uniqueGroupsCount = uniqueGroups.length;

    if (uniqueGroups.length >= 2) {
      let cvSqErr = 0;
      let cvAbsErr = 0;
      let cvTotalCount = 0;

      for (const groupVal of uniqueGroups) {
        const trainX: number[][] = [];
        const trainY: number[] = [];
        const testIndices: number[] = [];

        for (let i = 0; i < n; i++) {
          if (sampleGroups[i] === groupVal) {
            testIndices.push(i);
          } else {
            trainX.push(X[i]);
            trainY.push(y[i]);
          }
        }

        // Fit model on training groups (without groupVal)
        const subModel = fitRidgeRegression(trainX, trainY, alpha, false);

        // Predict on all replicates of the held-out group
        for (const testIdx of testIndices) {
          const pred = predictRidge(X[testIdx], subModel);
          const err = pred - y[testIdx];
          cvSqErr += Math.pow(err, 2);
          cvAbsErr += Math.abs(err);
          cvTotalCount++;
        }
      }

      groupedCvRmse = Math.sqrt(cvSqErr / cvTotalCount);
      groupedCvMae = cvAbsErr / cvTotalCount;
      groupedCvR2 = ssTot > 0 ? Math.max(0, 1 - cvSqErr / ssTot) : null;
      predictionsCount = cvTotalCount;
    }
  }

  return {
    weights,
    intercept: w0,
    alpha,
    meanX,
    meanY,
    r2: r2 !== null ? parseFloat(r2.toFixed(4)) : null,
    rmse: parseFloat(rmse.toFixed(4)),
    mae: parseFloat(mae.toFixed(4)),
    loocvRmse: parseFloat(groupedCvRmse.toFixed(4)), // Aliased to grouped CV RMSE
    groupedCvRmse: parseFloat(groupedCvRmse.toFixed(4)),
    groupedCvMae: parseFloat(groupedCvMae.toFixed(4)),
    groupedCvR2: groupedCvR2 !== null ? parseFloat(groupedCvR2.toFixed(4)) : null,
    cvGroupsCount: uniqueGroupsCount,
    cvPredictionsCount: predictionsCount,
    standardsCount: n,
  };
}

export function predictRidge(absorbances: number[], model: RidgeModel): number {
  let pred = model.intercept;
  const p = Math.min(absorbances.length, model.weights.length);
  for (let j = 0; j < p; j++) {
    pred += model.weights[j] * absorbances[j];
  }
  return Math.max(0, pred);
}

export function getRidgeMetrics(model: RidgeModel, unit: string = 'mg P/L'): ModelMetrics {
  return {
    name: 'Full-Spectrum Ridge (L2)',
    type: 'ridge',
    r2: model.r2,
    rmse: model.rmse,
    rmseUnit: unit,
    mae: model.mae,
    loocvRmse: model.groupedCvRmse,
    groupedCvRmse: model.groupedCvRmse,
    groupedCvMae: model.groupedCvMae,
    groupedCvR2: model.groupedCvR2,
    cvGroupsCount: model.cvGroupsCount,
    cvPredictionsCount: model.cvPredictionsCount,
    equationOrParams: `α = ${model.alpha}, P = ${model.weights.length} wavelengths (Grouped CV: ${model.cvGroupsCount} concs)`,
  };
}
