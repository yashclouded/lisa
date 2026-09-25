// LISA: Water Source Context Visuals & Optical Schematic Generators
// Rule: Normal photo of water is NEVER a phosphate measurement.
// All visuals are explicitly labeled as contextual representations.

import { SampleSourceVisual } from './types';

// Helper to create compact inline SVGs for sample scenarios
function createScenarioSvg(
  primaryColor: string,
  secondaryColor: string,
  iconShape: 'tap' | 'well' | 'pond' | 'drain' | 'farm' | 'rain' | 'ro' | 'turbid' | 'dye' | 'clip' | 'misaligned' | 'industrial' | 'lead' | 'dim',
  title: string
): string {
  let iconSvg = '';

  switch (iconShape) {
    case 'tap':
      iconSvg = `
        <path d="M70,55 h35 v25 h-15 v40 h-20 v-40 h0" fill="none" stroke="${primaryColor}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M85,120 v30" stroke="#3b82f6" stroke-width="4" stroke-linecap="round" stroke-dasharray="4,6"/>
        <path d="M60,175 q25,12 50,0 q-25,18 -50,0" fill="#3b82f6" opacity="0.6"/>
      `;
      break;
    case 'well':
      iconSvg = `
        <rect x="65" y="90" width="70" height="70" rx="4" fill="none" stroke="${primaryColor}" stroke-width="5"/>
        <path d="M55,90 h90 M100,50 v40" stroke="${primaryColor}" stroke-width="5" stroke-linecap="round"/>
        <line x1="100" y1="90" x2="100" y2="135" stroke="#71717a" stroke-width="3" stroke-dasharray="3,3"/>
        <circle cx="100" cy="140" r="10" fill="#3b82f6" opacity="0.8"/>
      `;
      break;
    case 'pond':
      iconSvg = `
        <path d="M40,120 Q70,95 100,105 T160,115 Q170,145 130,155 T40,120 Z" fill="${secondaryColor}" opacity="0.75" stroke="${primaryColor}" stroke-width="4"/>
        <path d="M60,125 q10,-8 20,0 M105,120 q15,-8 30,0" stroke="${primaryColor}" stroke-width="3" fill="none"/>
        <circle cx="75" cy="115" r="4" fill="#10b981"/>
        <circle cx="125" cy="130" r="5" fill="#10b981"/>
      `;
      break;
    case 'drain':
      iconSvg = `
        <circle cx="100" cy="110" r="50" fill="none" stroke="${primaryColor}" stroke-width="6"/>
        <line x1="70" y1="85" x2="130" y2="135" stroke="${primaryColor}" stroke-width="4"/>
        <line x1="70" y1="135" x2="130" y2="85" stroke="${primaryColor}" stroke-width="4"/>
        <path d="M80,140 Q100,155 120,140" fill="none" stroke="#60a5fa" stroke-width="5"/>
      `;
      break;
    case 'farm':
      iconSvg = `
        <path d="M40,150 L80,90 L120,150 Z" fill="${secondaryColor}" opacity="0.6"/>
        <path d="M100,150 L140,80 L170,150 Z" fill="${secondaryColor}" opacity="0.8"/>
        <path d="M40,150 Q100,135 160,150" stroke="#16a34a" stroke-width="4" fill="none"/>
        <path d="M80,150 v15 M110,148 v17 M135,150 v15" stroke="#16a34a" stroke-width="3"/>
      `;
      break;
    case 'rain':
      iconSvg = `
        <path d="M60,95 a20,20 0 0,1 32,-12 a25,25 0 0,1 42,8 a18,18 0 0,1 -4,34 h-66 a16,16 0 0,1 -4,-30 z" fill="#93c5fd" stroke="${primaryColor}" stroke-width="4"/>
        <line x1="75" y1="135" x2="68" y2="155" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>
        <line x1="100" y1="135" x2="93" y2="155" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>
        <line x1="125" y1="135" x2="118" y2="155" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>
      `;
      break;
    case 'ro':
      iconSvg = `
        <rect x="65" y="70" width="70" height="90" rx="10" fill="none" stroke="${primaryColor}" stroke-width="5"/>
        <line x1="75" y1="100" x2="125" y2="100" stroke="${primaryColor}" stroke-width="3" stroke-dasharray="4,4"/>
        <line x1="75" y1="125" x2="125" y2="125" stroke="${primaryColor}" stroke-width="3" stroke-dasharray="4,4"/>
        <path d="M100,50 v20 M100,160 v20" stroke="#3b82f6" stroke-width="4"/>
      `;
      break;
    case 'turbid':
      iconSvg = `
        <rect x="75" y="70" width="50" height="90" rx="4" fill="${secondaryColor}" stroke="${primaryColor}" stroke-width="4"/>
        <circle cx="88" cy="95" r="3" fill="#a16207"/>
        <circle cx="110" cy="105" r="2.5" fill="#a16207"/>
        <circle cx="95" cy="125" r="3.5" fill="#a16207"/>
        <circle cx="108" cy="140" r="2" fill="#a16207"/>
        <circle cx="85" cy="145" r="3" fill="#a16207"/>
      `;
      break;
    case 'dye':
      iconSvg = `
        <path d="M90,65 Q100,50 110,65 L125,120 Q130,140 100,145 Q70,140 75,120 Z" fill="#eab308" opacity="0.85" stroke="#ca8a04" stroke-width="4"/>
        <circle cx="95" cy="120" r="6" fill="#fef08a"/>
      `;
      break;
    case 'clip':
      iconSvg = `
        <rect x="60" y="80" width="80" height="60" rx="6" fill="#ef4444" opacity="0.2" stroke="#ef4444" stroke-width="5"/>
        <line x1="60" y1="110" x2="140" y2="110" stroke="#ef4444" stroke-width="5" stroke-dasharray="6,4"/>
        <text x="100" y="105" fill="#ef4444" font-family="monospace" font-size="16" font-weight="bold" text-anchor="middle">CLIP 255</text>
      `;
      break;
    case 'misaligned':
      iconSvg = `
        <line x1="100" y1="60" x2="100" y2="160" stroke="#94a3b8" stroke-width="3" stroke-dasharray="4,4"/>
        <rect x="116" y="80" width="40" height="65" rx="4" fill="none" stroke="#f59e0b" stroke-width="4"/>
        <path d="M102,112 h12" stroke="#f59e0b" stroke-width="3" marker-end="url(#arrow)"/>
        <text x="100" y="175" fill="#f59e0b" font-family="monospace" font-size="12" text-anchor="middle">+8px OFFSET</text>
      `;
      break;
    case 'industrial':
      iconSvg = `
        <path d="M60,160 v-50 l30,20 v-20 l30,20 v-40 h30 v70 z" fill="${secondaryColor}" stroke="${primaryColor}" stroke-width="4"/>
        <line x1="145" y1="80" x2="145" y2="60" stroke="#71717a" stroke-width="3"/>
      `;
      break;
    case 'lead':
      iconSvg = `
        <rect x="70" y="80" width="60" height="70" rx="6" fill="#f43f5e" opacity="0.2" stroke="#e11d48" stroke-width="4"/>
        <text x="100" y="122" fill="#e11d48" font-family="monospace" font-size="18" font-weight="bold" text-anchor="middle">Pb²⁺</text>
        <line x1="65" y1="75" x2="135" y2="145" stroke="#e11d48" stroke-width="4"/>
      `;
      break;
    case 'dim':
      iconSvg = `
        <circle cx="100" cy="110" r="35" fill="none" stroke="#64748b" stroke-width="4" stroke-dasharray="3,5"/>
        <line x1="100" y1="60" x2="100" y2="70" stroke="#64748b" stroke-width="3"/>
        <text x="100" y="115" fill="#64748b" font-family="monospace" font-size="11" text-anchor="middle">LOW LUX</text>
      `;
      break;
  }

  const rawSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 210" width="100%" height="100%">
      <defs>
        <linearGradient id="bgGrad_${iconShape}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#faf9f7"/>
          <stop offset="100%" stop-color="#f0ede6"/>
        </linearGradient>
      </defs>
      <rect width="200" height="210" rx="14" fill="url(#bgGrad_${iconShape})"/>
      <rect x="1" y="1" width="198" height="208" rx="13" fill="none" stroke="#e6e2db" stroke-width="1.5"/>
      ${iconSvg}
      <!-- Mandatory Scientific Watermark -->
      <rect x="10" y="180" width="180" height="20" rx="4" fill="rgba(22,24,29,0.06)"/>
      <text x="100" y="194" fill="#71717a" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="7.8" font-weight="600" text-anchor="middle" letter-spacing="0.04em">
        CONTEXT ONLY • NOT A DIRECT MEASUREMENT
      </text>
      <text x="100" y="28" fill="#16181d" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="600" text-anchor="middle">
        ${title}
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(rawSvg)}`;
}

export const SOURCE_VISUALS: Record<string, SampleSourceVisual> = {
  tap_water: {
    id: 'vis_tap_water',
    title: 'Municipal Tap Water',
    description: 'Piped drinking water from municipal supply with low dissolved solutes and high clarity.',
    category: 'tap',
    dominantColor: '#0b6e7f',
    secondaryColor: '#e0f2fe',
    clarity: 'crystal',
    svgDataUri: createScenarioSvg('#0b6e7f', '#bae6fd', 'tap', 'Municipal Tap Water'),
    watermark: 'ILLUSTRATIVE SCENARIO • CONTEXT ONLY • NOT DIRECT SPECTRAL INPUT',
  },
  borewell_water: {
    id: 'vis_borewell_water',
    title: 'Borewell / Groundwater',
    description: 'Deep aquifer groundwater extracted via electric pump. High mineral baseline.',
    category: 'groundwater',
    dominantColor: '#475569',
    secondaryColor: '#f1f5f9',
    clarity: 'clear',
    svgDataUri: createScenarioSvg('#475569', '#cbd5e1', 'well', 'Borewell Water'),
    watermark: 'ILLUSTRATIVE SCENARIO • CONTEXT ONLY • NOT DIRECT SPECTRAL INPUT',
  },
  pond_water: {
    id: 'vis_pond_water',
    title: 'Eutrophic Village Pond',
    description: 'Stagnant rural water body subject to surface runoff and seasonal microalgal bloom.',
    category: 'surface',
    dominantColor: '#15803d',
    secondaryColor: '#dcfce7',
    clarity: 'turbid',
    svgDataUri: createScenarioSvg('#15803d', '#bbf7d0', 'pond', 'Village Pond'),
    watermark: 'ILLUSTRATIVE SCENARIO • CONTEXT ONLY • NOT DIRECT SPECTRAL INPUT',
  },
  drain_runoff: {
    id: 'vis_drain_runoff',
    title: 'Stormwater / Urban Drain',
    description: 'Open drainage channel with mixed domestic wash water and street runoff.',
    category: 'drain',
    dominantColor: '#b45309',
    secondaryColor: '#fef3c7',
    clarity: 'turbid',
    svgDataUri: createScenarioSvg('#b45309', '#fde68a', 'drain', 'Stormwater Drain'),
    watermark: 'ILLUSTRATIVE SCENARIO • CONTEXT ONLY • NOT DIRECT SPECTRAL INPUT',
  },
  ag_runoff: {
    id: 'vis_ag_runoff',
    title: 'Agricultural Fertilizer Runoff',
    description: 'Irrigation furrow tailwater draining fields treated with DAP/NPK fertilizer.',
    category: 'agricultural',
    dominantColor: '#166534',
    secondaryColor: '#dcfce7',
    clarity: 'turbid',
    svgDataUri: createScenarioSvg('#166534', '#86efac', 'farm', 'Agricultural Runoff'),
    watermark: 'ILLUSTRATIVE SCENARIO • CONTEXT ONLY • NOT DIRECT SPECTRAL INPUT',
  },
  rainwater: {
    id: 'vis_rainwater',
    title: 'Rainwater Catchment',
    description: 'Rooftop rainwater harvesting tank; near-zero ionic content, pristine clarity.',
    category: 'rain',
    dominantColor: '#2563eb',
    secondaryColor: '#dbeafe',
    clarity: 'crystal',
    svgDataUri: createScenarioSvg('#2563eb', '#bfdbfe', 'rain', 'Rainwater Catchment'),
    watermark: 'ILLUSTRATIVE SCENARIO • CONTEXT ONLY • NOT DIRECT SPECTRAL INPUT',
  },
  ro_water: {
    id: 'vis_ro_water',
    title: 'RO Purified Water',
    description: 'Reverse osmosis permeate from laboratory purifier. Strict zero-analyte blank.',
    category: 'ro',
    dominantColor: '#0891b2',
    secondaryColor: '#cffafe',
    clarity: 'crystal',
    svgDataUri: createScenarioSvg('#0891b2', '#a5f3fc', 'ro', 'RO Filtered Water'),
    watermark: 'ILLUSTRATIVE SCENARIO • CONTEXT ONLY • NOT DIRECT SPECTRAL INPUT',
  },
  turbid_water: {
    id: 'vis_turbid_water',
    title: 'Turbid Surface Water',
    description: 'River water laden with suspended colloidal clay and silt causing Mie scattering.',
    category: 'turbid',
    dominantColor: '#854d0e',
    secondaryColor: '#fef9c3',
    clarity: 'opaque',
    svgDataUri: createScenarioSvg('#854d0e', '#fef08a', 'turbid', 'Turbid Water (Clay)'),
    watermark: 'ILLUSTRATIVE SCENARIO • CONTEXT ONLY • NOT DIRECT SPECTRAL INPUT',
  },
  unknown_dye: {
    id: 'vis_unknown_dye',
    title: 'Unknown Dye Contaminant',
    description: 'Spill sample colored with tartrazine yellow/green food dye. Non-phosphate optical signature.',
    category: 'adversarial',
    dominantColor: '#ca8a04',
    secondaryColor: '#fef08a',
    clarity: 'colored',
    svgDataUri: createScenarioSvg('#ca8a04', '#fef9c3', 'dye', 'Unknown Food Dye'),
    watermark: 'ILLUSTRATIVE SCENARIO • CONTEXT ONLY • NOT DIRECT SPECTRAL INPUT',
  },
  saturated_sample: {
    id: 'vis_saturated_sample',
    title: 'Saturated Sensor Overexposure',
    description: 'Hardware failure: CMOS camera exposure ceiling exceeded. Pixel intensities clip at 255.',
    category: 'adversarial',
    dominantColor: '#dc2626',
    secondaryColor: '#fee2e2',
    clarity: 'crystal',
    svgDataUri: createScenarioSvg('#dc2626', '#fca5a5', 'clip', 'Sensor Overexposure'),
    watermark: 'HARDWARE FAULT SIMULATION • EXPOSURE OVERFLOW',
  },
  misaligned_sample: {
    id: 'vis_misaligned_sample',
    title: 'Misaligned Cuvette Housing',
    description: 'Mechanical displacement: cuvette +8px off registration axis. Distorts wavelength calibration.',
    category: 'adversarial',
    dominantColor: '#d97706',
    secondaryColor: '#fef3c7',
    clarity: 'clear',
    svgDataUri: createScenarioSvg('#d97706', '#fde68a', 'misaligned', 'Cuvette Misaligned'),
    watermark: 'HARDWARE FAULT SIMULATION • REGISTRATION DRIFT',
  },
  industrial_effluent: {
    id: 'vis_industrial_effluent',
    title: 'High-Strength Industrial Effluent',
    description: 'Detergent factory discharge: 1.85 mg P/L, far above linear calibration range.',
    category: 'industrial',
    dominantColor: '#9333ea',
    secondaryColor: '#f3e8ff',
    clarity: 'colored',
    svgDataUri: createScenarioSvg('#9333ea', '#e9d5ff', 'industrial', 'Industrial Effluent'),
    watermark: 'ILLUSTRATIVE SCENARIO • CONTEXT ONLY • NOT DIRECT SPECTRAL INPUT',
  },
  uncalibrated_lead: {
    id: 'vis_uncalibrated_lead',
    title: 'Uncalibrated Metal (Lead Dithizone)',
    description: 'Industrial discharge with lead complex (520 nm peak). Engine must refuse measurement.',
    category: 'adversarial',
    dominantColor: '#e11d48',
    secondaryColor: '#ffe4e6',
    clarity: 'colored',
    svgDataUri: createScenarioSvg('#e11d48', '#fecdd3', 'lead', 'Lead (Uncalibrated)'),
    watermark: 'UNSUPPORTED ANALYTE TEST • CROSS-CONTAMINATION CHECK',
  },
  uncalibrated_metal: {
    id: 'vis_uncalibrated_metal',
    title: 'Uncalibrated Metal (Iron Phenanthroline)',
    description: 'Industrial discharge with iron complex (510 nm peak). Engine must refuse uncalibrated analyte.',
    category: 'adversarial',
    dominantColor: '#ea580c',
    secondaryColor: '#ffedd5',
    clarity: 'colored',
    svgDataUri: createScenarioSvg('#ea580c', '#fed7aa', 'lead', 'Iron (Uncalibrated)'),
    watermark: 'UNSUPPORTED ANALYTE TEST • CROSS-CONTAMINATION CHECK',
  },
  lead_standard: {
    id: 'vis_lead_standard',
    title: 'Lead Standard (Dithizone Complex)',
    description: 'Simulated pink lead-dithizonate chromophore (peak 520 nm).',
    category: 'industrial',
    dominantColor: '#e11d48',
    secondaryColor: '#ffe4e6',
    clarity: 'colored',
    svgDataUri: createScenarioSvg('#e11d48', '#fecdd3', 'lead', 'Lead Dithizone (Simulated)'),
    watermark: 'SIMULATED DATASET • CONTEXT ONLY • RESEARCH CALIBRATION',
  },
  dim_light: {
    id: 'vis_dim_light',
    title: 'Attenuated / Low-Light Capture',
    description: 'Hardware failure: dying battery / degraded LED delivering insufficient optical flux.',
    category: 'adversarial',
    dominantColor: '#475569',
    secondaryColor: '#e2e8f0',
    clarity: 'clear',
    svgDataUri: createScenarioSvg('#475569', '#cbd5e1', 'dim', 'Low Optical Flux'),
    watermark: 'HARDWARE FAULT SIMULATION • WEAK THROUGHPUT',
  },
};
