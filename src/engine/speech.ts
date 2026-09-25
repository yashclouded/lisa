// LISA: Multilingual Voice Diagnostic Readout
// Uses Web Speech API for Hindi and English accessible field guidance

export interface AudioReadoutParams {
  analyteName: string;
  concentration: number;
  uncertainty: number;
  unit: string;
  verdict: 'SAFE' | 'CAUTION' | 'ALERT' | 'REJECTED';
  isHindi: boolean;
}

export function generateSpeechText(params: AudioReadoutParams): string {
  const concStr = params.concentration.toFixed(2);
  const uncertStr = params.uncertainty.toFixed(2);

  if (params.verdict === 'REJECTED') {
    if (params.isHindi) {
      return 'लीसा ने माप अस्वीकार कर दिया है। नमूने का स्पेक्ट्रम असामान्य है। कृपया प्रयोगशाला में जांच कराएं।';
    }
    return 'LISA has rejected the measurement. The optical signature is outside the calibrated space. Laboratory verification required.';
  }

  if (params.isHindi) {
    let verdictHindi = 'यह पानी सुरक्षित है।';
    if (params.verdict === 'CAUTION') verdictHindi = 'सावधानी: यह स्तर सामान्य से अधिक है।';
    if (params.verdict === 'ALERT') verdictHindi = 'चेतावनी: यह पानी असुरक्षित है। प्रदूषण की संभावना है।';

    return `${params.analyteName} की मात्रा ${concStr} प्लस माइनस ${uncertStr} ${params.unit} है। ${verdictHindi}`;
  }

  let verdictEng = 'Water is within normal guidelines.';
  if (params.verdict === 'CAUTION') verdictEng = 'Caution: Concentration is moderately elevated.';
  if (params.verdict === 'ALERT') verdictEng = 'Alert: Contamination likely. Exceeds freshwater guidance threshold.';

  return `${params.analyteName} concentration is ${concStr} plus minus ${uncertStr} ${params.unit}. ${verdictEng}`;
}

export function speakDiagnostic(params: AudioReadoutParams): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser.');
    return false;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const text = generateSpeechText(params);
  const utterance = new SpeechSynthesisUtterance(text);

  const langCode = params.isHindi ? 'hi-IN' : 'en-IN';
  utterance.lang = langCode;
  utterance.rate = 0.95;
  utterance.pitch = 1.0;

  // Try to find matching voice
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang.startsWith(params.isHindi ? 'hi' : 'en'));
  if (voice) {
    utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
