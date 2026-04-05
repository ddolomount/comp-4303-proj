export class Hud {
  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud__panel">
        <div class="hud__title">Core Status</div>
        <div class="hud__stat"><span>Health</span><span class="hud__value" data-health>100 / 100</span></div>
        <div class="hud__stat"><span>Multiplier</span><span class="hud__value" data-multiplier>x1</span></div>
        <div class="hud__stat"><span>Wave</span><span class="hud__value" data-wave>1</span></div>
      </div>
      <div class="hud__panel">
        <div class="hud__title">Combat Feed</div>
        <div class="hud__stat"><span>Score</span><span class="hud__value" data-score>0</span></div>
        <div class="hud__stat"><span>Enemies</span><span class="hud__value" data-enemies>0</span></div>
        <div class="hud__stat"><span>State</span><span class="hud__value" data-state>Online</span></div>
      </div>
    `;

    this.message = document.createElement('div');
    this.message.className = 'hud__message hidden';

    document.body.appendChild(this.root);
    document.body.appendChild(this.message);

    this.health = this.root.querySelector('[data-health]');
    this.multiplier = this.root.querySelector('[data-multiplier]');
    this.wave = this.root.querySelector('[data-wave]');
    this.score = this.root.querySelector('[data-score]');
    this.enemies = this.root.querySelector('[data-enemies]');
    this.state = this.root.querySelector('[data-state]');

    this.messageTimer = 0;
    this.stickyMessage = false;
  }

  setMessage(text, sticky = false) {
    this.message.textContent = text;
    this.message.classList.remove('hidden');
    this.messageTimer = 2.4;
    this.stickyMessage = sticky;
  }

  render(data, dt) {
    this.health.textContent = `${Math.max(0, Math.ceil(data.health))} / ${data.maxHealth}`;
    this.multiplier.textContent = data.multiplier > 1
      ? `x${data.multiplier.toFixed(1)} ${data.multiplierTimer.toFixed(1)}s`
      : 'x1.0';
    this.wave.textContent = `${data.wave}`;
    this.score.textContent = `${Math.floor(data.score)}`;
    this.enemies.textContent = `${data.enemies}`;
    this.state.textContent = data.gameOver ? 'Offline' : 'Online';

    if (!this.stickyMessage) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) {
        this.message.classList.add('hidden');
      }
    }
  }
}
