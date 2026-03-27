import * as THREE from 'three';
import * as Setup from './setup.js';
import { Arena } from './game/Arena.js';
import { Hud } from './game/Hud.js';
import { InputController } from './game/InputController.js';
import { Enemy } from './game/entities/Enemy.js';
import { Pickup } from './game/entities/Pickup.js';
import { Player } from './game/entities/Player.js';
import { Projectile } from './game/entities/Projectile.js';

const CAMERA_OFFSET = new THREE.Vector3(0, 34, 10);

export class World {
  constructor() {
    Setup.installPageStyles();

    this.scene = Setup.createScene();
    this.camera = Setup.createCamera();
    this.renderer = Setup.createRenderer();
    this.clock = new THREE.Clock();

    this.hud = new Hud();
    this.input = new InputController(this.renderer.domElement);

    this.projectiles = [];
    this.enemies = [];
    this.pickups = [];

    this.score = 0;
    this.wave = 0;
    this.pendingWaveTimer = 0;
    this.gameOver = false;
    this.arenaRegenerated = false;

    this.spawnAccumulator = 0;
  }

  init() {
    Setup.createLights(this.scene);

    this.arena = new Arena(this.scene);
    this.player = new Player(this.scene);
    this.player.setPosition(this.arena.center.x, this.arena.center.z);

    this.hud.setMessage('Enter the arena');
    this.startWave();

    window.addEventListener('resize', () => this.handleResize());
  }

  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  restart() {
    for (const projectile of this.projectiles) {
      projectile.dispose(this.scene);
    }

    for (const enemy of this.enemies) {
      enemy.dispose(this.scene);
    }

    for (const pickup of this.pickups) {
      pickup.dispose(this.scene);
    }

    this.projectiles = [];
    this.enemies = [];
    this.pickups = [];

    this.score = 0;
    this.wave = 0;
    this.pendingWaveTimer = 0;
    this.gameOver = false;
    this.arenaRegenerated = false;

    this.arena.generate();
    this.player.reset();
    this.player.setPosition(this.arena.center.x, this.arena.center.z);
    this.hud.setMessage('System rebooted');
    this.startWave();
  }

  startWave() {
    this.wave += 1;
    this.pendingWaveTimer = 0;
    this.arenaRegenerated = false;

    this.clearTransientObjects();
    this.arena.generate();
    this.player.setPosition(this.arena.center.x, this.arena.center.z);
    this.player.syncVisuals();

    const enemyCount = 4 + this.wave * 2;
    for (let i = 0; i < enemyCount; i += 1) {
      const variant = Math.random() < Math.min(0.25 + this.wave * 0.06, 0.55) ? 'ranged' : 'melee';
      const spawn = this.arena.getEdgeSpawnPoint(this.player.position, 16);
      const enemy = new Enemy(this.scene, this, variant, this.wave);
      enemy.setPosition(spawn.x, spawn.z);
      this.enemies.push(enemy);
    }

    this.spawnWavePickups();
    this.hud.setMessage(`Wave ${this.wave}`);
  }

  clearTransientObjects() {
    for (const projectile of this.projectiles) {
      projectile.dispose(this.scene);
    }

    for (const enemy of this.enemies) {
      enemy.dispose(this.scene);
    }

    for (const pickup of this.pickups) {
      pickup.dispose(this.scene);
    }

    this.projectiles = [];
    this.enemies = [];
    this.pickups = [];
  }

  spawnWavePickups() {
    const healthSpot = this.arena.getRandomOpenPoint(this.player.position, 10);
    const multiplierSpot = this.arena.getRandomOpenPoint(this.player.position, 12);

    this.pickups.push(new Pickup(this.scene, 'health', healthSpot));
    this.pickups.push(new Pickup(this.scene, 'multiplier', multiplierSpot));
  }

  addProjectile(config) {
    const projectile = new Projectile(this.scene, config);
    this.projectiles.push(projectile);
    return projectile;
  }

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.input.updatePointerWorld(this.camera);

    if (this.gameOver) {
      if (this.input.consumeRestart()) {
        this.restart();
      }

      this.updateHud(dt);
      this.updateCamera(dt);
      return;
    }

    this.player.update(dt, this.input, this);

    for (const enemy of this.enemies) {
      enemy.update(dt);
    }

    for (const projectile of this.projectiles) {
      projectile.update(dt);
    }

    for (const pickup of this.pickups) {
      pickup.update(dt);
    }

    this.resolveProjectileHits();
    this.resolvePickupCollection();
    this.cleanupObjects();
    this.updateWaveFlow(dt);
    this.updateCamera(dt);
    this.updateHud(dt);
  }

  updateWaveFlow(dt) {
    if (this.enemies.length > 0) {
      return;
    }

    this.pendingWaveTimer += dt;

    if (!this.arenaRegenerated && this.pendingWaveTimer > 1.2) {
      this.hud.setMessage('Arena rerouting');
      this.arenaRegenerated = true;
    }

    if (this.pendingWaveTimer > 2.4) {
      this.startWave();
    }
  }

  updateCamera(dt) {
    const desired = this.player.position.clone().add(CAMERA_OFFSET);
    this.camera.position.lerp(desired, Math.min(1, dt * 4));
    this.camera.lookAt(this.player.position.x, 0, this.player.position.z);
  }

  resolveProjectileHits() {
    for (const projectile of this.projectiles) {
      if (!projectile.alive) {
        continue;
      }

      if (this.arena.collidesCircle(projectile.position.x, projectile.position.z, projectile.radius)) {
        projectile.alive = false;
        continue;
      }

      if (projectile.owner === 'player') {
        for (const enemy of this.enemies) {
          if (!enemy.alive) {
            continue;
          }

          if (projectile.position.distanceTo(enemy.position) <= projectile.radius + enemy.radius) {
            enemy.takeDamage(projectile.damage);
            projectile.alive = false;

            if (!enemy.alive) {
              this.score += enemy.scoreValue * this.player.getScoreMultiplier();
              if (Math.random() < 0.16) {
                const pickupKind = Math.random() < 0.6 ? 'health' : 'multiplier';
                this.pickups.push(new Pickup(this.scene, pickupKind, enemy.position));
              }
            }

            break;
          }
        }
      } else if (projectile.position.distanceTo(this.player.position) <= projectile.radius + this.player.radius) {
        this.player.takeDamage(projectile.damage);
        projectile.alive = false;
      }
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      if (enemy.variant === 'melee' && enemy.position.distanceTo(this.player.position) <= enemy.attackRange + this.player.radius) {
        enemy.touchPlayer();
      }
    }
  }

  resolvePickupCollection() {
    for (const pickup of this.pickups) {
      if (!pickup.alive) {
        continue;
      }

      if (pickup.position.distanceTo(this.player.position) <= pickup.radius + this.player.radius) {
        pickup.apply(this.player);
        pickup.alive = false;
      }
    }
  }

  cleanupObjects() {
    this.projectiles = this.projectiles.filter((projectile) => {
      if (projectile.alive) {
        return true;
      }

      projectile.dispose(this.scene);
      return false;
    });

    this.enemies = this.enemies.filter((enemy) => {
      if (enemy.alive) {
        return true;
      }

      enemy.dispose(this.scene);
      return false;
    });

    this.pickups = this.pickups.filter((pickup) => {
      if (pickup.alive) {
        return true;
      }

      pickup.dispose(this.scene);
      return false;
    });
  }

  updateHud(dt) {
    if (this.player.health <= 0 && !this.gameOver) {
      this.gameOver = true;
      this.hud.setMessage('Core failure - press R to restart', true);
    }

    this.hud.render({
      score: this.score,
      wave: this.wave,
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      enemies: this.enemies.length,
      multiplier: this.player.getScoreMultiplier(),
      multiplierTimer: this.player.multiplierTimer,
      gameOver: this.gameOver,
    }, dt);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
