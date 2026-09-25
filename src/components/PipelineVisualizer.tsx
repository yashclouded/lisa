// LISA: Computational pipeline indicator
// A quiet progress rail, not a dashboard. Each stage keeps its full scientific
// description and governing equation in its tooltip, so the depth is still
// there for anyone who goes looking for it.

import React from 'react';
import {
  Camera,
  Crop,
  Activity,
  Layers,
  Zap,
  Cpu,
  CheckCircle2,
  TrendingUp,
  FileCheck,
} from 'lucide-react';

export interface PipelineStage {
  id: string;
  name: string;
  shortLabel: string;
  icon: React.ReactNode;
  description: string;
  technicalFormula?: string;
  outputSummary?: string;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'input',
    name: '1. Optical Acquisition',
    shortLabel: 'Capture',
    icon: <Camera className="w-3.5 h-3.5" />,
    description:
      'Dispersed transmission spectrum captured via diffraction grating onto smartphone CMOS sensor.',
    technicalFormula: 'I(x, y) ∈ [0, 255]^{W × H}',
  },
  {
    id: 'roi',
    name: '2. Computer Vision ROI',
    shortLabel: 'Extract',
    icon: <Crop className="w-3.5 h-3.5" />,
    description:
      'Automatic variance-based bounding box isolation & spatial column binning across dispersed band.',
    technicalFormula: 'I(x) = (1/H) ∑_y I(x, y)',
  },
  {
    id: 'spectrum',
    name: '3. Wavelength Registration',
    shortLabel: 'Register',
    icon: <Activity className="w-3.5 h-3.5" />,
    description:
      'Polynomial registration of pixel columns to physical wavelengths (nm) via CFL Hg emission lines.',
    technicalFormula: 'λ(x) = a·x + b (R² ≥ 0.999)',
  },
  {
    id: 'blank',
    name: '4. Blank Correction',
    shortLabel: 'Blank',
    icon: <Layers className="w-3.5 h-3.5" />,
    description:
      'Ratio against reference solvent to eliminate illumination profile and optical baseline drift.',
    technicalFormula: 'A(λ) = -log₁₀(I_sample / I_blank)',
  },
  {
    id: 'physics',
    name: '5. Beer-Lambert Physics',
    shortLabel: 'Physics',
    icon: <Zap className="w-3.5 h-3.5" />,
    description:
      'Classical linear absorbance model on the integrated 630–690 nm molybdenum blue peak band.',
    technicalFormula: 'A_band = ε·ℓ·c = k·c + b',
  },
  {
    id: 'ml',
    name: '6. Full-Spectrum ML',
    shortLabel: 'Ridge',
    icon: <Cpu className="w-3.5 h-3.5" />,
    description:
      'L2-regularized Ridge regression across 151 spectral bands, evaluated via Leave-One-Out Cross-Validation.',
    technicalFormula: 'ŵ = (XᵀX + αI)⁻¹Xᵀy',
  },
  {
    id: 'qc',
    name: '7. Multi-Tier QC',
    shortLabel: 'Validate',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    description:
      'Automatic verification of sensor saturation, alignment drift (±6px), turbidity, and out-of-distribution anomaly.',
    technicalFormula: 'D_OOD = (1/P) ∑ |(A - μ) / σ| ≤ 1.8',
  },
  {
    id: 'uncertainty',
    name: '8. Uncertainty Quantifier',
    shortLabel: 'Uncertainty',
    icon: <TrendingUp className="w-3.5 h-3.5" />,
    description:
      'Empirical standard error combining cross-validation residual variance with spectral manifold distance.',
    technicalFormula: 'c ± t_{0.95} · SE(c)',
  },
  {
    id: 'result',
    name: '9. Diagnostic Verdict',
    shortLabel: 'Verdict',
    icon: <FileCheck className="w-3.5 h-3.5" />,
    description:
      'BIS IS 10500 / WHO pollution classification with Hindi/English voice and audit logging.',
    technicalFormula: 'SAFE < 0.05 | ALERT > 0.10 mg/L',
  },
];

interface PipelineVisualizerProps {
  currentStageIndex: number;
  isProcessing: boolean;
  onSelectStage: (stage: PipelineStage) => void;
}

export const PipelineVisualizer: React.FC<PipelineVisualizerProps> = ({
  currentStageIndex,
  isProcessing,
  onSelectStage,
}) => {
  const lastIndex = PIPELINE_STAGES.length - 1;
  const settled = !isProcessing && currentStageIndex >= lastIndex;

  return (
    <nav className="pipeline" aria-label="Analysis pipeline">
      <div className="pipeline__inner">
        {PIPELINE_STAGES.map((stage, idx) => {
          const state = settled
            ? 'done'
            : idx < currentStageIndex
              ? 'done'
              : idx === currentStageIndex
                ? 'active'
                : 'pending';

          const statusWord =
            state === 'done' ? 'complete' : state === 'active' ? 'in progress' : 'pending';

          return (
            <React.Fragment key={stage.id}>
              <button
                type="button"
                className="pipeline__step"
                data-state={state}
                onClick={() => onSelectStage(stage)}
                title={`${stage.name} — ${stage.description}${
                  stage.technicalFormula ? `\n${stage.technicalFormula}` : ''
                }`}
              >
                <span className="pipeline__dot" aria-hidden="true" />
                <span aria-hidden="true">{stage.shortLabel}</span>
                <span className="sr-only">
                  Step {idx + 1} of {PIPELINE_STAGES.length}, {stage.name}: {statusWord}
                </span>
              </button>
              {idx < lastIndex && <span className="pipeline__link" aria-hidden="true" />}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};
