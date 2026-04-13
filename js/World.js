import * as THREE from "three";
import * as Setup from "./setup.js";
import { TileMap } from "./maps/TileMap.js";
import { Hud } from "./ui/Hud.js";
import { InputHandler } from "./input/InputHandler.js";
import { EnemyEntity } from "./entities/EnemyEntity.js";
import { PickupEntity } from "./entities/PickupEntity.js";
import { PlayerEntity } from "./entities/PlayerEntity.js";
import { ProjectileEntity } from "./entities/ProjectileEntity.js";
import { ProtectEntity } from "./entities/ProtectEntity.js";
import { WaveDirector } from "./gameflow/WaveDirector.js";
import { StateMachine } from "./ai/decisions/StateMachine.js";
import { JPS } from "./ai/pathfinding/JPS.js";
import { AStar } from "./ai/pathfinding/AStar.js";
import { AssetLoader } from "./loaders/AssetLoader.js";
import { IntroState } from "./gameflow/states/IntroState.js";
import { WaveSetupState } from "./gameflow/states/WaveSetupState.js";

let CAMERA_OFFSET = new THREE.Vector3(0, 34, 10);
let PROTECT_SPAWN_TILE_RADIUS = 3;
let PATH_HEURISTIC = AStar.manhattan;

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

    this.projectiles = [];
    this.enemies = [];
    this.pickups = [];
    this.protectEntity = null;

    this.score = 0;
    this.wave = 0;
    this.pendingWaveTimer = 0;
    this.gameOver = false;
    this.arenaRegenerated = false;

    this.spawnAccumulator = 0;
  }

  // Initialize objects and HUD in our world
  init() {
    // Build scene lighting and main entities
    Setup.createLights(this.scene);

    this.map = new TileMap(this.scene, { rows: 31, cols: 31, tileSize: 3 });
    this.player = new PlayerEntity(
      this.scene,
      this.assetLoader.getPlayerModel()
    );
    this.player.setPosition(this.map.center.x, this.map.center.z);
    this.gameStateMachine = new StateMachine(this, new IntroState());
    this.gameStateMachine.state.enter(this);

    // Start loading models while fallback meshes are already playable
    this.assetLoader.loadAssetsInBackground(this);
  }

  // Restart game upon loss
  restart() {
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

    this.score = 0;
    this.wave = 0;
    this.pendingWaveTimer = 0;
    this.currentWaveConfig = null;
    this.gameOver = false;
    this.arenaRegenerated = false;

    this.player.reset();
    this.player.setPosition(this.map.center.x, this.map.center.z);
    this.hud.setMessage("System rebooted");
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

    let enemyCount = 4 + this.wave * 2;
    for (let i = 0; i < enemyCount; i += 1) {
      let variant =
        Math.random() < Math.min(0.25 + this.wave * 0.06, 0.55)
          ? "ranged"
          : "melee";
      let spawn = this.map.getEdgeSpawnPoint(this.player.position, 16);
      let enemy = new EnemyEntity(
        this.scene,
        this,
        variant,
        this.wave,
        this.assetLoader.getEnemyModel(variant)
      );
      enemy.setPosition(spawn.x, spawn.z);
      this.enemies.push(enemy);
    }

    this.spawnWavePickups();
    this.hud.setMessage(`Wave ${this.wave}`);
  }

  spawnEnemies(config) {
    // Skip if world has not initialized map or enemy list
    if (!this.map || !this.enemies) {
      return;
    }

    let meleeChance = config.enemyMix?.melee ?? 0.55;
    let enemyCount = config.enemyCount ?? 0;

    for (let i = 0; i < enemyCount; i++) {
      // Pick enemy variant based on wave config
      let variant = Math.random() < meleeChance ? "melee" : "ranged";
      let spawn = this.map.getEdgeSpawnPoint(this.player?.position, 16);
      let enemyClass = this.enemyClass ?? EnemyEntity;
      let enemy = new enemyClass(
        this.scene,
        this,
        variant,
        this.wave,
        this.assetLoader.getEnemyModel(variant)
      );
      enemy.setPosition(spawn.x, spawn.z);
      this.enemies.push(enemy);
    }
  }

  getProtectSpawnPoint(radius = 0.7) {
    // Fall back to map center if player or map are missing
    if (!this.map || !this.player) {
      return this.map?.center?.clone?.() ?? new THREE.Vector3();
    }

    let playerTile = this.map.quantize(this.player.position);
    if (!playerTile) {
      return this.map.getRandomOpenPoint(this.player.position, 0);
    }

    // Search nearby tiles for a safe protect objective spawn
    let candidates = [];
    for (
      let dr = -PROTECT_SPAWN_TILE_RADIUS;
      dr <= PROTECT_SPAWN_TILE_RADIUS;
      dr += 1
    ) {
      for (
        let dc = -PROTECT_SPAWN_TILE_RADIUS;
        dc <= PROTECT_SPAWN_TILE_RADIUS;
        dc += 1
      ) {
        if (Math.hypot(dr, dc) > PROTECT_SPAWN_TILE_RADIUS) {
          continue;
        }

        let row = playerTile.row + dr;
        let col = playerTile.col + dc;
        if (!this.map.isWalkable(row, col)) {
          continue;
        }

        let point = this.map.localizeRowCol(row, col);
        let minimumDistance = this.player.radius + radius + 0.4;
        if (
          point.distanceTo(this.player.position) >= minimumDistance &&
          !this.map.collidesCircle(point.x, point.z, radius)
        ) {
          candidates.push(point);
        }
      }
    }

    if (candidates.length === 0) {
      return this.map.getRandomOpenPoint(this.player.position, 0);
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  spawnProtect(config) {
    // Create protect objective for protect waves
    if (!this.map) {
      return;
    }

    if (this.protectEntity) {
      this.protectEntity.dispose(this.scene);
      this.protectEntity = null;
    }

    // Apply wave-specific objective health if provided
    let protectConfig = config?.protectTarget ?? {};
    let protectEntity = new ProtectEntity(
      this.scene,
      this.assetLoader.getProtectModel()
    );
    let spawnPoint = this.getProtectSpawnPoint(protectEntity.radius);

    if (typeof protectConfig.health === "number") {
      protectEntity.maxHealth = protectConfig.health;
      protectEntity.health = protectConfig.health;
      protectEntity.updateHealthBar();
    } else {
      protectEntity.reset();
    }

    protectEntity.setPosition(spawnPoint.x, spawnPoint.z);
    this.protectEntity = protectEntity;
    return protectEntity;
  }

  getPathfinder() {
    // Create or refresh JPS pathfinder when map renderer changes
    if (!this.map) {
      return null;
    }

    let shouldRefreshPathfinder =
      !this.pathfinder ||
      this.pathfinder.map !== this.map ||
      this.pathfinder.tileMapRenderer !== this.map.renderer;

    if (shouldRefreshPathfinder) {
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
    let healthSpot = this.map.getRandomOpenPoint(this.player.position, 10);
    let multiplierSpot = this.map.getRandomOpenPoint(this.player.position, 12);

    this.pickups.push(
      new PickupEntity(
        this.scene,
        "health",
        healthSpot,
        this.assetLoader.getPickupModel("health")
      )
    );
    this.pickups.push(
      new PickupEntity(
        this.scene,
        "multiplier",
        multiplierSpot,
        this.assetLoader.getPickupModel("multiplier")
      )
    );
  }

  addProjectile(config) {
    // Add projectile to world update list
    let projectile = new ProjectileEntity(this.scene, config);
    this.projectiles.push(projectile);
    return projectile;
  }

  // Update our world
  update() {
    let dt = Math.min(this.clock.getDelta(), 0.05);
    this.input.updatePointerWorld(this.camera);

    if (this.gameStateMachine) {
      this.gameStateMachine.update(dt);
    }

    this.updateCamera(dt);
    this.updateHud(dt);
  }

  updateCamera(dt) {
    // Keep camera following player
    let desired = this.player.position.clone().add(CAMERA_OFFSET);
    this.camera.position.copy(desired);
    this.camera.lookAt(this.player.position.x, 0, this.player.position.z);
  }

  resolveProjectileHits() {
    // Check projectile impacts against walls, enemies and objectives
    for (let projectile of this.projectiles) {
      if (!projectile.alive) {
        continue;
      }

      if (
        this.map.collidesCircle(
          projectile.position.x,
          projectile.position.z,
          projectile.radius
        )
      ) {
        projectile.alive = false;
        continue;
      }

      if (projectile.owner === "player") {
        for (let enemy of this.enemies) {
          if (!enemy.alive) {
            continue;
          }

          if (
            projectile.position.distanceTo(enemy.position) <=
            projectile.radius + enemy.radius
          ) {
            // Damage enemy and award score on kill
            enemy.takeDamage(projectile.damage);
            projectile.alive = false;

            if (!enemy.alive) {
              this.score += enemy.scoreValue * this.player.getScoreMultiplier();
              if (Math.random() < 0.16) {
                // Chance to drop pickup from defeated enemy
                let pickupKind = Math.random() < 0.6 ? "health" : "multiplier";
                this.pickups.push(
                  new PickupEntity(
                    this.scene,
                    pickupKind,
                    enemy.position,
                    this.assetLoader.getPickupModel(pickupKind)
                  )
                );
              }
            }

            break;
          }
        }
      } else {
        if (
          projectile.position.distanceTo(this.player.position) <=
          projectile.radius + this.player.radius
        ) {
          this.player.takeDamage(projectile.damage);
          projectile.alive = false;
          continue;
        }

        if (
          this.protectEntity &&
          this.protectEntity.health > 0 &&
          projectile.position.distanceTo(this.protectEntity.position) <=
            projectile.radius + this.protectEntity.radius
        ) {
          this.protectEntity.takeDamage(projectile.damage);
          projectile.alive = false;
        }
      }
    }

    // Check melee contact damage against player
    for (let enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      if (
        enemy.variant === "melee" &&
        enemy.position.distanceTo(this.player.position) <=
          enemy.attackRange + this.player.radius
      ) {
        enemy.touchPlayer();
      }
    }
  }

  resolvePickupCollection() {
    // Apply pickups when player reaches them
    for (let pickup of this.pickups) {
      if (!pickup.alive) {
        continue;
      }

      if (
        pickup.position.distanceTo(this.player.position) <=
        pickup.radius + this.player.radius
      ) {
        pickup.apply(this.player);
        pickup.alive = false;
      }
    }
  }

  cleanupObjects() {
    // Remove dead projectiles
    this.projectiles = this.projectiles.filter((projectile) => {
      if (projectile.alive) {
        return true;
      }

      projectile.dispose(this.scene);
      return false;
    });

    // Remove dead enemies
    this.enemies = this.enemies.filter((enemy) => {
      if (enemy.alive) {
        return true;
      }

      enemy.dispose(this.scene);
      return false;
    });

    // Remove collected pickups
    this.pickups = this.pickups.filter((pickup) => {
      if (pickup.alive) {
        return true;
      }

      pickup.dispose(this.scene);
      return false;
    });
  }

  updateHud(dt) {
    // Send current world state to HUD
    this.hud.render(
      {
        score: this.score,
        wave: this.wave,
        health: this.player.health,
        maxHealth: this.player.maxHealth,
        enemies: this.enemies.length,
        multiplier: this.player.getScoreMultiplier(),
        multiplierTimer: this.player.multiplierTimer,
        damageMultiplier: this.player.getDamageMultiplier(),
        damageBoostTimer: this.player.damageBoostTimer,
        damageBoostCooldown: this.player.damageBoostCooldown,
        gameOver: this.gameOver
      },
      dt
    );
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
