export class Hud {
  constructor() {
    // Create main HUD panels
    this.root = document.createElement("div");
    this.root.className = "hud";
    this.root.innerHTML = `
      <div class="hud__panel">
        <div class="hud__title">Core Status</div>
        <div class="hud__stat"><span>Health</span><span class="hud__value" data-health>100 / 100</span></div>
        <div class="hud__stat"><span>Multiplier</span><span class="hud__value" data-multiplier>x1</span></div>
        <div class="hud__stat">
          <span>Damage</span>
          <span class="hud__value" data-damage-boost>Ready</span>
        </div>
        <div class="hud__stat"><span>Wave</span><span class="hud__value" data-wave>1</span></div>
      </div>
      <div class="hud__panel">
        <div class="hud__title">Combat Feed</div>
        <div class="hud__stat"><span>Score</span><span class="hud__value" data-score>0</span></div>
        <div class="hud__stat"><span>Enemies</span><span class="hud__value" data-enemies>0</span></div>
        <div class="hud__stat"><span>State</span><span class="hud__value" data-state>Online</span></div>
      </div>
    `;

    this.message = document.createElement("div");
    this.message.className = "hud__message hidden";
    this.intro = null;

    // Add HUD elements to the page
    document.body.appendChild(this.root);
    document.body.appendChild(this.message);

    // Cache HUD value elements for faster updates
    this.health = this.root.querySelector("[data-health]");
    this.multiplier = this.root.querySelector("[data-multiplier]");
    this.damageBoost = this.root.querySelector("[data-damage-boost]");
    this.wave = this.root.querySelector("[data-wave]");
    this.score = this.root.querySelector("[data-score]");
    this.enemies = this.root.querySelector("[data-enemies]");
    this.state = this.root.querySelector("[data-state]");

    this.messageTimer = 0;
    this.stickyMessage = false;
  }

  showIntro(onStart) {
    // Replace any existing intro overlay
    this.hideIntro();

    // Create start screen overlay
    this.intro = document.createElement("div");
    this.intro.className = "hud__intro";
    this.intro.innerHTML = `
      <div class="hud__intro-panel">
        <div class="hud__intro-title">Motherboard Breach</div>
        <p class="hud__intro-text">
          Viruses are attacking the motherboard. Eliminate them before the
          system fails.
        </p>
        <button class="hud__intro-button" type="button">Begin</button>
      </div>
    `;

    // Start game when player presses begin
    let button = this.intro.querySelector(".hud__intro-button");
    button.addEventListener("click", onStart);
    document.body.appendChild(this.intro);
  }

  hideIntro() {
    // Remove start screen overlay if it exists
    if (!this.intro) {
      return;
    }

    this.intro.remove();
    this.intro = null;
  }

  setMessage(text, sticky = false) {
    // Show temporary or sticky message banner
    this.message.textContent = text;
    this.message.classList.remove("hidden");
    this.messageTimer = 2.4;
    this.stickyMessage = sticky;
  }

  render(data, dt) {
    // Update HUD values from world state
    this.health.textContent = `${Math.max(0, Math.ceil(data.health))} / ${data.maxHealth}`;
    this.multiplier.textContent =
      data.multiplier > 1
        ? `x${data.multiplier.toFixed(1)} ${data.multiplierTimer.toFixed(1)}s`
        : "x1.0";
    this.damageBoost.textContent = this.getDamageBoostText(data);
    this.wave.textContent = `${data.wave}`;
    this.score.textContent = `${Math.floor(data.score)}`;
    this.enemies.textContent = `${data.enemies}`;
    this.state.textContent = data.gameOver ? "Offline" : "Online";

    // Hide temporary message after timer expires
    if (!this.stickyMessage) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) {
        this.message.classList.add("hidden");
      }
    }
  }

  getDamageBoostText(data) {
    // Show remaining active boost time
    if (data.damageMultiplier > 1) {
      let timer = data.damageBoostTimer.toFixed(1);
      return `x${data.damageMultiplier.toFixed(1)} ${timer}s`;
    }

    // Show cooldown until boost is ready
    if (data.damageBoostCooldown > 0) {
      return `Ready in ${data.damageBoostCooldown.toFixed(1)}s`;
    }

    return "Ready";
  }
}
