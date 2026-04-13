export class WaveDirector {
  constructor() {}

  getWaveConfig(waveNumber) {
    let protectWave = this.isProtectWave(waveNumber);

    return {
      type: protectWave ? "protect" : "normal",

      // Increase enemy count based on wave
      enemyCount: 4 + waveNumber * 2,

      enemyMix: {
        melee: protectWave ? 0.7 : 0.55,
        ranged: protectWave ? 0.3 : 0.45
      },

      // Increase objective health based on wave
      protectTarget: protectWave ? { health: 200 + waveNumber * 20 } : null
    };
  }

  isProtectWave(waveNumber) {
    return waveNumber % 3 === 0;
  }
}
