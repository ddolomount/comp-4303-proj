import * as THREE from 'three';
import { DynamicEntity } from './DynamicEntity.js';
import { StateMachine } from '../ai/decisions/StateMachine.js';
import { PatrolState } from '../ai/decisions/EnemyStates/PatrolState.js';
import { ChaseState } from '../ai/decisions/EnemyStates/ChaseState.js';
import { AttackState } from '../ai/decisions/EnemyStates/AttackState.js';

const VARIANT_CONFIG = {
  melee: {
    color: '#ff8778',
    emissive: '#ff6657',
    speed: 15,
    health: 52,
    detectionRange: 18,
    attackRange: 1.45,
    attackCooldown: 0.72,
    damage: 12,
    scoreValue: 100,
  },
  ranged: {
    color: '#7ca9ff',
    emissive: '#70a0ff',
    speed: 8,
    health: 38,
    detectionRange: 24,
    attackRange: 12,
    attackCooldown: 1.35,
    damage: 10,
    scoreValue: 135,
  },
};

export class EnemyEntity extends DynamicEntity {
  constructor(scene, world, variant, wave) {
    const config = VARIANT_CONFIG[variant];
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.58, 0.9, 8, 16),
      new THREE.MeshStandardMaterial({
        color: config.color,
        emissive: config.emissive,
        emissiveIntensity: 0.4,
        metalness: 0.18,
        roughness: 0.36,
      })
    );
    body.castShadow = true;
    group.add(body);

    const sensor = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.24, 0.9),
      new THREE.MeshStandardMaterial({
        color: '#061817',
        emissive: '#cffff6',
        emissiveIntensity: 0.18,
      })
    );
    sensor.position.set(0, 0.2, 0.85);
    group.add(sensor);

    super({
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(1.2, 1.3, 1.2),
      mesh: group,
      topSpeed: config.speed,
      friction: 0.97,
      mass: 1,
      maxForce: 42,
    });

    this.scene = scene;
    this.world = world;
    this.variant = variant;
    this.config = config;
    this.wave = wave;
    this.radius = 0.72;
    this.height = 1.3;
    this.forward = new THREE.Vector3(0, 0, 1);
    this.alive = true;
    this.alerted = false;
    this.wanderTarget = null;
    this.cooldown = 0;
    this.lostSightTimer = 0;
    this.attackRange = config.attackRange;
    this.maxHealth = config.health + Math.max(0, wave - 1) * 7;
    this.health = this.maxHealth;
    this.scoreValue = config.scoreValue + (wave - 1) * 10;
    this.meleeEngageRange = this.attackRange + 0.85;
    this.stateMachine = new StateMachine(this, new PatrolState());
    this.stateMachine.state.enter(this);

    this.scene.add(this.mesh);
    this.syncVisuals();
  }

  setPosition(x, z) {
    this.position.set(x, 0, z);
    this.syncVisuals();
  }

  update(dt) {
    if (!this.alive) {
      return;
    }

    this.cooldown = Math.max(0, this.cooldown - dt);
    this.stateMachine.update(dt);

    this.velocity.addScaledVector(this.acceleration, dt);
    this.velocity.multiplyScalar(this.friction);
    this.velocity.clampLength(0, this.topSpeed);
    this.position.copy(this.world.map.moveWithCollisions(this.position, this.velocity, this.radius, dt));

    if (this.velocity.lengthSq() > 0.0001) {
      this.forward.lerp(this.velocity.clone().normalize(), Math.min(1, dt * 14));
    }

    this.syncVisuals();
    this.acceleration.set(0, 0, 0);
  }

  syncVisuals() {
    this.mesh.position.set(this.position.x, this.height / 2, this.position.z);
    if (this.forward.lengthSq() > 0.001) {
      this.mesh.rotation.y = Math.atan2(this.forward.x, this.forward.z);
    }
  }

  canSeePlayer() {
    const player = this.world.player;
    const distance = this.position.distanceTo(player.position);
    if (distance > this.config.detectionRange) {
      return false;
    }

    return this.world.map.hasLineOfSight(this.position, player.position);
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    this.alerted = true;

    if (this.health === 0) {
      this.alive = false;
      return;
    }

    if (!(this.stateMachine.state instanceof ChaseState) && !(this.stateMachine.state instanceof AttackState)) {
      this.stateMachine.change(new ChaseState());
    }
  }

  touchPlayer() {
    if (this.cooldown > 0) {
      return;
    }

    this.velocity.multiplyScalar(0.2);
    this.cooldown = this.config.attackCooldown;
    this.world.player.takeDamage(this.config.damage);
  }

  fireAtPlayer() {
    if (this.cooldown > 0) {
      return;
    }

    const direction = this.world.player.position.clone().sub(this.position).setY(0);
    if (direction.lengthSq() === 0) {
      return;
    }

    this.cooldown = this.config.attackCooldown;
    this.world.addProjectile({
      owner: 'enemy',
      position: this.position.clone().add(direction.clone().normalize().multiplyScalar(1.1)).setY(0.45),
      direction,
      speed: 16,
      damage: this.config.damage,
      radius: 0.24,
      lifetime: 1.8,
      color: '#ffb08c',
    });
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
