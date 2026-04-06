export class WaveDirector {
  constructor() {}

  getWaveConfig(waveNumber) {
    let protectWave = this.isProtectWave(waveNumber);

    return {
      type: protectWave ? 'protect' : 'normal',
      enemyCount: 4 + waveNumber * 2,
      enemyMix: {
        melee: protectWave ? 0.7 : 0.55,
        ranged: protectWave ? 0.3 : 0.45,
      },
      duration: protectWave ? 30 : null,
      protectTarget: protectWave ? { health: 200 + waveNumber * 20} : null,
    };
  }

  isProtectWave(waveNumber) {
    return waveNumber % 3 === 0;
  }
}
