// LISA: Simulated Head-to-Head Laboratory UV-Vis Concordance Benchmark
// Synthetic split-sample protocol modeling benchtop Shimadzu UV-2600 double beam vs LISA prototype
// based on standard published molar extinction coefficients.
// NOTE: This benchmark series is SIMULATED for demonstration and protocol validation;
// it does not represent physical wet-lab split-sample experimental trial data.

export type DataProvenance = 'SIMULATED' | 'EXPERIMENTAL' | 'VALIDATED' | 'REFERENCE';

export interface LabBenchmarkComparison {
  sampleId: string;
  sampleLabel: string;
  trueConcMgL: number;
  uvVisBenchtopAbs650: number; // Simulated Shimadzu UV-2600 double beam model
  uvVisConcMgL: number;
  lisaAbs650: number;          // Simulated LISA smartphone optical model
  lisaConcMgL: number;
  relativeErrorPercent: number;
  concordanceStatus: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE';
  provenance: DataProvenance;
}

export const LAB_BENCHMARK_SERIES: LabBenchmarkComparison[] = [
  {
    sampleId: 'BENCH-01',
    sampleLabel: 'Std 0.10 mg P/L',
    trueConcMgL: 0.10,
    uvVisBenchtopAbs650: 0.124,
    uvVisConcMgL: 0.102,
    lisaAbs650: 0.121,
    lisaConcMgL: 0.098,
    relativeErrorPercent: 3.9,
    concordanceStatus: 'EXCELLENT',
    provenance: 'SIMULATED',
  },
  {
    sampleId: 'BENCH-02',
    sampleLabel: 'Std 0.20 mg P/L',
    trueConcMgL: 0.20,
    uvVisBenchtopAbs650: 0.248,
    uvVisConcMgL: 0.201,
    lisaAbs650: 0.243,
    lisaConcMgL: 0.196,
    relativeErrorPercent: 2.5,
    concordanceStatus: 'EXCELLENT',
    provenance: 'SIMULATED',
  },
  {
    sampleId: 'BENCH-03',
    sampleLabel: 'Std 0.40 mg P/L',
    trueConcMgL: 0.40,
    uvVisBenchtopAbs650: 0.495,
    uvVisConcMgL: 0.398,
    lisaAbs650: 0.502,
    lisaConcMgL: 0.409,
    relativeErrorPercent: 2.8,
    concordanceStatus: 'EXCELLENT',
    provenance: 'SIMULATED',
  },
  {
    sampleId: 'BENCH-04',
    sampleLabel: 'Std 0.60 mg P/L',
    trueConcMgL: 0.60,
    uvVisBenchtopAbs650: 0.738,
    uvVisConcMgL: 0.595,
    lisaAbs650: 0.748,
    lisaConcMgL: 0.612,
    relativeErrorPercent: 2.9,
    concordanceStatus: 'EXCELLENT',
    provenance: 'SIMULATED',
  },
  {
    sampleId: 'BENCH-05',
    sampleLabel: 'Std 0.80 mg P/L',
    trueConcMgL: 0.80,
    uvVisBenchtopAbs650: 0.982,
    uvVisConcMgL: 0.796,
    lisaAbs650: 0.971,
    lisaConcMgL: 0.785,
    relativeErrorPercent: 1.4,
    concordanceStatus: 'EXCELLENT',
    provenance: 'SIMULATED',
  },
  {
    sampleId: 'BENCH-06',
    sampleLabel: 'Std 1.00 mg P/L',
    trueConcMgL: 1.00,
    uvVisBenchtopAbs650: 1.231,
    uvVisConcMgL: 0.997,
    lisaAbs650: 1.215,
    lisaConcMgL: 0.984,
    relativeErrorPercent: 1.3,
    concordanceStatus: 'EXCELLENT',
    provenance: 'SIMULATED',
  },
  {
    sampleId: 'BENCH-07',
    sampleLabel: 'Sonipat Agricultural Runoff (Vial Y)',
    trueConcMgL: 0.40,
    uvVisBenchtopAbs650: 0.492,
    uvVisConcMgL: 0.399,
    lisaAbs650: 0.506,
    lisaConcMgL: 0.411,
    relativeErrorPercent: 3.0,
    concordanceStatus: 'EXCELLENT',
    provenance: 'SIMULATED',
  },
];
