import * as THREE from "three";
import { DynamicEntity } from "./DynamicEntity.js";
import { StateMachine } from "../ai/decisions/StateMachine.js";
import { PatrolState } from "../ai/decisions/EnemyStates/PatrolState.js";
import { ChaseState } from "../ai/decisions/EnemyStates/ChaseState.js";
import { AttackPlayerState } from "../ai/decisions/EnemyStates/AttackPlayerState.js";
import {
  createModelInstance,
  pickDefaultAnimationClip
} from "../loaders/ModelUtils.js";

let VARIANT_CONFIG = {
  melee: {
    color: "#ff8778",
    emissive: "#ff6657",
    speed: 15,
    health: 52,
    detectionRange: 18,
    attackRange: 1.45,
    attackCooldown: 0.72,
    damage: 12,
    scoreValue: 100
  },
  ranged: {
    color: "#7ca9ff",
    emissive: "#70a0ff",
    speed: 8,
    health: 38,
    detectionRange: 24,
    attackRange: 12,
    attackCooldown: 1.35,
    damage: 10,
    scoreValue: 135
  }
};

let HEALTH_BAR_WIDTH = 1.15;
let HEALTH_BAR_HEIGHT = 0.14;
let ENEMY_RADIUS = 0.82;
let ENEMY_HEIGHT = 1.55;

export class EnemyEntity extends DynamicEntity {
  constructor(scene, world, variant, wave, modelTemplate = null) {
    let config = VARIANT_CONFIG[variant];
    let { mesh, clips } = EnemyEntity.createMesh(config, modelTemplate);

    super({
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(1.35, ENEMY_HEIGHT, 1.35),
      mesh,
      topSpeed: config.speed,
      friction: 0.97,
      mass: 1,
      maxForce: 42
    });

    this.scene = scene;
    this.world = world;
    this.variant = variant;
    this.config = config;
    this.wave = wave;
    this.radius = ENEMY_RADIUS;
    this.height = ENEMY_HEIGHT;
    this.forward = new THREE.Vector3(0, 0, 1);
    this.alive = true;
    this.alerted = false;
    this.wanderTarget = null;
    this.cooldown = 0;
    this.lostSightTimer = 0;
    this.protectPath = [];
    this.protectPathIndex = 0;
    this.protectPathGoalKey = null;
    this.protectRepathTimer = 0;
    this.attackRange = config.attackRange;
    this.maxHealth = config.health + Math.max(0, wave - 1) * 7;
    this.health = this.maxHealth;
    this.scoreValue = config.scoreValue + (wave - 1) * 10;
    this.meleeEngageRange = this.attackRange + 0.85;
    this.animationMixer = null;
    this.animationActions = new Map();
    this.activeAnimation = null;
    this.setupAnimations(clips);
    this.createHealthBar();
    this.updateHealthBar();
    this.stateMachine = new StateMachine(this, new PatrolState());
    this.stateMachine.state.enter(this);

    this.scene.add(this.mesh);
    this.syncVisuals();
  }

  static createMesh(config, modelTemplate) {
    let group = new THREE.Group();

    // Try to create visual instance of model
    let { model, clips } = createModelInstance(modelTemplate, {
      targetHeight: ENEMY_HEIGHT
    });
    if (model) {
      group.add(model);
      return { mesh: group, clips };
    }

    // Create default mesh if no model
    let body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.68, 1.05, 8, 16),
      new THREE.MeshStandardMaterial({
        color: config.color,
        emissive: config.emissive,
        emissiveIntensity: 0.4,
        metalness: 0.18,
        roughness: 0.36
      })
    );
    body.castShadow = true;
    group.add(body);

    // Simple sensor on front of mesh
    let sensor = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.28, 1.05),
      new THREE.MeshStandardMaterial({
        color: "#061817",
        emissive: "#cffff6",
        emissiveIntensity: 0.18
      })
    );
    sensor.position.set(0, 0.25, 0.95);
    group.add(sensor);

    return { mesh: group, clips: [] };
  }

  // Initialize animation playback for model
  setupAnimations(clips) {
    // Clear previous animations
    this.resetAnimations();

    if (!clips?.length) {
      return;
    }

    this.animationMixer = new THREE.AnimationMixer(this.mesh);

    // Cache actions to be played later
    for (let clip of clips) {
      this.animationActions.set(
        clip.name,
        this.animationMixer.clipAction(clip)
      );
    }

    // Start default animation if one is available
    this.playAnimation(pickDefaultAnimationClip(clips)?.name);
  }

  playAnimation(name) {
    if (
      !name ||
      !this.animationActions.has(name) ||
      this.activeAnimation === name
    ) {
      return;
    }

    // Stop all previous actions so only one played at a time
    for (let action of this.animationActions.values()) {
      action.stop();
    }

    // Restart and play requested animation clip
    let action = this.animationActions.get(name);
    action.reset();
    action.play();
    this.activeAnimation = name;
  }

  resetAnimations() {
    if (this.animationMixer) {
      // Stop all currently playing clips and clear cache
      this.animationMixer.stopAllAction();
      this.animationMixer.uncacheRoot(this.mesh);
    }

    this.animationMixer = null;
    this.animationActions = new Map();
    this.activeAnimation = null;
  }

  applyModelTemplate(modelTemplate) {
    // Build new model
    let { mesh, clips } = EnemyEntity.createMesh(this.config, modelTemplate);

    // Replace current mesh with model
    this.replaceVisualMesh(mesh);
    this.setupAnimations(clips);
    this.syncVisuals();
    this.updateHealthBar();
  }

  replaceVisualMesh(newMesh) {
    this.clearVisualChildren();
    while (newMesh.children.length > 0) {
      this.mesh.add(newMesh.children[0]);
    }
  }

  clearVisualChildren() {
    let preserved = this.healthBarGroup
      ? new Set([this.healthBarGroup])
      : new Set();
    let children = [...this.mesh.children];
    for (let child of children) {
      if (preserved.has(child)) {
        continue;
      }
      this.mesh.remove(child);
      this.disposeObject3D(child);
    }
  }

  disposeObject3D(object) {
    object.traverse((child) => {
      // Free geometry buffers
      if (child.geometry) {
        child.geometry.dispose();
      }

      // Free materials
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  setPosition(x, z) {
    this.position.set(x, 0, z);
    this.syncVisuals();
  }

  update(dt) {
    // Skip dead enemies
    if (!this.alive) {
      return;
    }

    // Advance animation
    if (this.animationMixer) {
      this.animationMixer.update(dt);
    }

    // Count down timers and update current state
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.stateMachine.update(dt);

    // Apply physics and collision-aware movement
    this.velocity.addScaledVector(this.acceleration, dt);
    this.velocity.multiplyScalar(this.friction);
    this.velocity.clampLength(0, this.topSpeed);
    this.position.copy(
      this.world.map.moveWithCollisions(
        this.position,
        this.velocity,
        this.radius,
        dt
      )
    );

    // Face toward movement direction
    if (this.velocity.lengthSq() > 0.0001) {
      this.forward.lerp(
        this.velocity.clone().normalize(),
        Math.min(1, dt * 14)
      );
    }

    this.syncVisuals();
    this.acceleration.set(0, 0, 0);
  }

  syncVisuals() {
    // Position enemy model
    this.mesh.position.set(this.position.x, this.height / 2, this.position.z);

    // Rotate enemy to face current forward direction
    if (this.forward.lengthSq() > 0.001) {
      this.mesh.rotation.y = Math.atan2(this.forward.x, this.forward.z);
    }
  }

  canSeePlayer() {
    // Check if player is close enough to detect
    let player = this.world.player;
    let distance = this.position.distanceTo(player.position);
    if (distance > this.config.detectionRange) {
      return false;
    }

    // Check if walls block sight to player
    return this.world.map.hasLineOfSight(this.position, player.position);
  }

  isProtectObjectiveActive() {
    return (
      this.world.currentWaveConfig?.type === "protect" &&
      Boolean(this.world.protectEntity)
    );
  }

  takeDamage(amount) {
    // Remove damage taken from health
    this.health = Math.max(0, this.health - amount);
    this.alerted = true;
    this.updateHealthBar();

    // Mark enemy dead once health is gone
    if (this.health === 0) {
      this.alive = false;
      return;
    }

    if (this.isProtectObjectiveActive()) {
      return;
    }

    // Chase player after taking damage outside protect waves
    if (
      !(this.stateMachine.state instanceof ChaseState) &&
      !(this.stateMachine.state instanceof AttackPlayerState)
    ) {
      this.stateMachine.change(new ChaseState());
    }
  }

  createHealthBar() {
    // Create health bar above enemy
    this.healthBarGroup = new THREE.Group();
    this.healthBarGroup.position.set(0, this.height * 0.95, 0);
    this.healthBarGroup.rotation.x = -Math.PI / 2;

    let background = new THREE.Mesh(
      new THREE.PlaneGeometry(HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT),
      new THREE.MeshBasicMaterial({
        color: "#200909",
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );

    let fill = new THREE.Mesh(
      new THREE.PlaneGeometry(
        HEALTH_BAR_WIDTH - 0.04,
        HEALTH_BAR_HEIGHT - 0.04
      ),
      new THREE.MeshBasicMaterial({
        color: "#71ff80",
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );

    background.renderOrder = 15;
    fill.renderOrder = 16;
    background.position.z = -0.01;

    this.healthBarFill = fill;
    this.healthBarGroup.add(background);
    this.healthBarGroup.add(fill);
    this.mesh.add(this.healthBarGroup);
  }

  updateHealthBar() {
    // Skip if health bar is not ready
    if (!this.healthBarFill || !this.healthBarGroup) {
      return;
    }

    // Scale health bar fill to match current health
    let ratio = THREE.MathUtils.clamp(this.health / this.maxHealth, 0, 1);
    this.healthBarFill.scale.x = ratio;
    this.healthBarFill.position.x =
      -((1 - ratio) * (HEALTH_BAR_WIDTH - 0.04)) / 2;
    this.healthBarGroup.visible = this.alive && ratio > 0;

    if (ratio > 0.6) {
      this.healthBarFill.material.color.set("#71ff80");
    } else if (ratio > 0.3) {
      this.healthBarFill.material.color.set("#ffd85f");
    } else {
      this.healthBarFill.material.color.set("#ff6d6d");
    }
  }

  touchPlayer() {
    // Melee attack player if cooldown has expired
    if (this.cooldown > 0) {
      return;
    }

    this.velocity.multiplyScalar(0.2);
    this.cooldown = this.config.attackCooldown;
    this.world.player.takeDamage(this.config.damage);
  }

  touchProtectObjective() {
    // Melee attack protect objective if cooldown has expired
    if (this.cooldown > 0 || !this.world.protectEntity) {
      return;
    }

    this.velocity.multiplyScalar(0.2);
    this.cooldown = this.config.attackCooldown;
    this.world.protectEntity.takeDamage(this.config.damage);
  }

  fireAtPlayer() {
    // Fire projectile at player if cooldown has expired
    if (this.cooldown > 0) {
      return;
    }

    let direction = this.world.player.position
      .clone()
      .sub(this.position)
      .setY(0);
    if (direction.lengthSq() === 0) {
      return;
    }

    // Spawn projectile in front of enemy
    this.cooldown = this.config.attackCooldown;
    this.world.addProjectile({
      owner: "enemy",
      position: this.position
        .clone()
        .add(direction.clone().normalize().multiplyScalar(1.1))
        .setY(0.45),
      direction,
      speed: 16,
      damage: this.config.damage,
      radius: 0.24,
      lifetime: 1.8,
      color: "#ffb08c"
    });
  }

  fireAtProtectObjective() {
    // Fire projectile at protect objective if cooldown has expired
    let protectEntity = this.world.protectEntity;
    if (this.cooldown > 0 || !protectEntity) {
      return;
    }

    let direction = protectEntity.position.clone().sub(this.position).setY(0);
    if (direction.lengthSq() === 0) {
      return;
    }

    // Spawn projectile in front of enemy
    this.cooldown = this.config.attackCooldown;
    this.world.addProjectile({
      owner: "enemy",
      position: this.position
        .clone()
        .add(direction.clone().normalize().multiplyScalar(1.1))
        .setY(0.45),
      direction,
      speed: 16,
      damage: this.config.damage,
      radius: 0.24,
      lifetime: 1.8,
      color: "#ffb08c"
    });
  }

  dispose(scene) {
    // Remove enemy, stop animations and dispose of model/mesh
    scene.remove(this.mesh);
    this.resetAnimations();
    this.disposeObject3D(this.mesh);
  }
}
