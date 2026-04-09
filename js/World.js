import * as THREE from 'three';
import * as Setup from './setup.js';
import { TileMap } from './maps/TileMap.js';
import { Hud } from './ui/Hud.js';
import { InputHandler } from './input/InputHandler.js';
import { EnemyEntity } from './entities/EnemyEntity.js';
import { PickupEntity } from './entities/PickupEntity.js';
import { PlayerEntity } from './entities/PlayerEntity.js';
import { ProjectileEntity } from './entities/ProjectileEntity.js';
import { ProtectEntity } from './entities/ProtectEntity.js';
import { WaveDirector } from './gameflow/WaveDirector.js';
import { StateMachine } from './ai/decisions/StateMachine.js';
import { JPS } from './ai/pathfinding/JPS.js';
import { AssetLoader } from './loaders/AssetLoader.js';
import { WaveSetupState } from './gameflow/states/WaveSetupState.js';

const CAMERA_OFFSET = new THREE.Vector3(0, 34, 10);
const PATH_HEURISTIC = (a, b, weight = 1) => (
  (Math.abs(a.row - b.row) + Math.abs(a.col - b.col)) * weight
);

export class World {
  constructor() {
    Setup.installPageStyles();

    this.scene = Setup.createScene();
    this.camera = Setup.createCamera();
    this.renderer = Setup.createRenderer();
    this.clock = new THREE.Clock();

    this.hud = new Hud();
    this.input = new InputHandler(this.camera, this.renderer.domElement);

    this.waveDirector = new WaveDirector();
    this.gameStateMachine = null;
    this.currentWaveConfig = null;
    this.pathfinder = null;
    this.assetLoader = new AssetLoader();
    this.assets = {};
    this.assetLoadPromise = null;
    
    this.projectiles = [];
    this.enemies = [];
    this.pickups = [];
    this.protectEntity = null;

    this.score = 0;
    this.wave = 0;
    this.pendingWaveTimer = 0;
    this.protectTimer = 0;
    this.gameOver = false;
    this.arenaRegenerated = false;

    this.spawnAccumulator = 0;
  }

  // Initialize objects and HUD in our world
  init() {
    Setup.createLights(this.scene);

    this.map = new TileMap(this.scene, { rows: 31, cols: 31, tileSize: 3 });
    this.player = new PlayerEntity(this.scene, this.assets.player);
    this.player.setPosition(this.map.center.x, this.map.center.z);
    this.gameStateMachine = new StateMachine(this, new WaveSetupState());
    this.gameStateMachine.state.enter(this);
    this.loadAssetsInBackground();
  }

  loadAssetsInBackground() {
    if (this.assetLoadPromise) {
      return this.assetLoadPromise;
    }

    this.assetLoadPromise = this.assetLoader.loadAll()
      .then((assets) => {
        this.assets = assets;
        this.applyLoadedAssets();
        return assets;
      })
      .catch((error) => {
        console.error('Failed to load GLB assets, using fallback meshes instead.', error);
        this.assets = {};
        return {};
      });

    return this.assetLoadPromise;
  }

  applyLoadedAssets() {
    if (this.player) {
      this.player.applyModelTemplate(this.assets.player);
    }

    for (const enemy of this.enemies) {
      enemy.applyModelTemplate(this.getEnemyModel(enemy.variant));
    }

    for (const pickup of this.pickups) {
      pickup.applyModelTemplate(this.getPickupModel(pickup.type));
    }
  }

  // Restart game upon loss
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
    if (this.protectEntity) {
      this.protectEntity.dispose(this.scene);
      this.protectEntity = null;
    }

    this.score = 0;
    this.wave = 0;
    this.pendingWaveTimer = 0;
    this.protectTimer = 0;
    this.currentWaveConfig = null;
    this.gameOver = false;
    this.arenaRegenerated = false;

    this.player.reset();
    this.player.setPosition(this.map.center.x, this.map.center.z);
    this.hud.setMessage('System rebooted');
    this.gameStateMachine.change(new WaveSetupState());
  }

  // Start new wave after previous restart or previous wave completed
  startWave() {
    this.wave += 1;
    this.pendingWaveTimer = 0;
    this.arenaRegenerated = false;

    this.clearTransientObjects();

    this.map.generate();

    this.player.setPosition(this.map.center.x, this.map.center.z);
    this.player.syncVisuals();

    const enemyCount = 4 + this.wave * 2;
    for (let i = 0; i < enemyCount; i += 1) {
      const variant = Math.random() < Math.min(0.25 + this.wave * 0.06, 0.55) ? 'ranged' : 'melee';
      const spawn = this.map.getEdgeSpawnPoint(this.player.position, 16);
      const enemy = new EnemyEntity(this.scene, this, variant, this.wave, this.getEnemyModel(variant));
      enemy.setPosition(spawn.x, spawn.z);
      this.enemies.push(enemy);
    }

    this.spawnWavePickups();
    this.hud.setMessage(`Wave ${this.wave}`);
  }

  spawnEnemies(config) {
    if (!this.map || !this.enemies) {
      return;
    }

    let meleeChance = config.enemyMix?.melee ?? 0.55;
    let enemyCount = config.enemyCount ?? 0;

    for (let i = 0; i < enemyCount; i++) {
      let variant = Math.random() < meleeChance ? 'melee' : 'ranged';
      let spawn = this.map.getEdgeSpawnPoint(this.player?.position, 16);
      let enemyClass = this.enemyClass ?? EnemyEntity;
      let enemy = new enemyClass(this.scene, this, variant, this.wave, this.getEnemyModel(variant));
      enemy.setPosition(spawn.x, spawn.z);
      this.enemies.push(enemy);
    }
  }

  getEnemyModel(variant) {
    return variant === 'melee'
      ? this.assets?.meleeEnemy
      : this.assets?.rangedEnemy;
  }

  getPickupModel(type) {
    return type === 'health'
      ? this.assets?.healthPickup
      : this.assets?.multiplierPickup;
  }

  spawnProtect(config) {
    if (!this.map) {
      return;
    }

    if (this.protectEntity) {
      this.protectEntity.dispose(this.scene);
      this.protectEntity = null;
    }

    const protectConfig = config?.protectTarget ?? {};
    const spawnPoint = this.map.getRandomOpenPoint(this.player?.position, 8);
    const protectEntity = new ProtectEntity(this.scene);

    if (typeof protectConfig.health === 'number') {
      protectEntity.maxHealth = protectConfig.health;
      protectEntity.health = protectConfig.health;
    } else {
      protectEntity.reset();
    }

    protectEntity.setPosition(spawnPoint.x, spawnPoint.z);
    this.protectEntity = protectEntity;
    return protectEntity;
  }

  getPathfinder() {
    if (!this.map) {
      return null;
    }

    if (
      !this.pathfinder ||
      this.pathfinder.map !== this.map ||
      this.pathfinder.tileMapRenderer !== this.map.renderer
    ) {
      this.pathfinder = new JPS(this.map, PATH_HEURISTIC, this.map.renderer);
    }

    return this.pathfinder;
  }

  // Reset dynamic parts of world
  clearTransientObjects() {
    for (let projectile of this.projectiles) {
      projectile.dispose(this.scene);
    }

    for (let enemy of this.enemies) {
      enemy.dispose(this.scene);
    }

    for (let pickup of this.pickups) {
      pickup.dispose(this.scene);
    }

    this.projectiles = [];
    this.enemies = [];
    this.pickups = [];

    if (this.protectEntity) {
      this.protectEntity.dispose(this.scene);
      this.protectEntity = null;
    }
  }

  // Spawn health packs and score multipliers
  spawnWavePickups() {
    const healthSpot = this.map.getRandomOpenPoint(this.player.position, 10);
    const multiplierSpot = this.map.getRandomOpenPoint(this.player.position, 12);

    this.pickups.push(new PickupEntity(this.scene, 'health', healthSpot, this.getPickupModel('health')));
    this.pickups.push(new PickupEntity(this.scene, 'multiplier', multiplierSpot, this.getPickupModel('multiplier')));
  }

  addProjectile(config) {
    const projectile = new ProjectileEntity(this.scene, config);
    this.projectiles.push(projectile);
    return projectile;
  }

  // Update our world
  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.input.updatePointerWorld(this.camera);

    if (this.gameStateMachine) {
      this.gameStateMachine.update(dt);
    }

    this.updateCamera(dt);
    this.updateHud(dt);
  }

  updateWaveFlow(dt) {
    if (this.enemies.length > 0) {
      return;
    }

    this.pendingWaveTimer += dt;

    if (!this.arenaRegenerated && this.pendingWaveTimer > 1.2) {
      this.hud.setMessage('Map rerouting');
      this.arenaRegenerated = true;
    }

    if (this.pendingWaveTimer > 2.4) {
      this.startWave();
    }
  }

  updateCamera(dt) {
    const desired = this.player.position.clone().add(CAMERA_OFFSET);
    this.camera.position.copy(desired);
    this.camera.lookAt(this.player.position.x, 0, this.player.position.z);
  }

  resolveProjectileHits() {
    for (const projectile of this.projectiles) {
      if (!projectile.alive) {
        continue;
      }

      if (this.map.collidesCircle(projectile.position.x, projectile.position.z, projectile.radius)) {
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
                this.pickups.push(
                  new PickupEntity(this.scene, pickupKind, enemy.position, this.getPickupModel(pickupKind))
                );
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
