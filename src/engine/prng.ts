// LISA: Deterministic Seeded Pseudo-Random Number Generator (PRNG)
// Uses Mulberry32 algorithm with MurmurHash3 seed hashing

export class SeededPRNG {
  private state: number;
  private originalSeed: string;

  constructor(seed: string = 'LISA-DEMO-2026') {
    this.originalSeed = seed;
    this.state = this.hashString(seed);
  }

  private hashString(str: string): number {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  }

  // Returns pseudo-random float in [0, 1)
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Uniform float between min and max
  public uniform(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  // Gaussian / Normal distribution using Box-Muller transform
  public gaussian(mean: number = 0, stdDev: number = 1): number {
    let u1 = this.next();
    let u2 = this.next();
    while (u1 <= 1e-15) {
      u1 = this.next();
    }
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  // Reset to original seed
  public reset(): void {
    this.state = this.hashString(this.originalSeed);
  }

  // Set new seed
  public setSeed(seed: string): void {
    this.originalSeed = seed;
    this.state = this.hashString(seed);
  }

  public getSeed(): string {
    return this.originalSeed;
  }
}

// Global default PRNG instance
export const defaultPRNG = new SeededPRNG('LISA-DEMO-2026');
