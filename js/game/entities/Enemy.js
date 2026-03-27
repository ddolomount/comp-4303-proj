import * as THREE from 'three';
import { AttackState, ChaseState, PatrolState } from '../../ai/decisions/EnemyStates.js';
import { StateMachine } from '../../ai/decisions/StateMachine.js';

const VARIANT_CONFIG = {
  melee: {
    color: '#ff8778',
    emissive: '#ff6657',
    speed: 7.3,
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
    speed: 5.8,
    health: 38,
    detectionRange: 24,
    attackRange: 12,
    attackCooldown: 1.35,
    damage: 10,
    scoreValue: 135,
  },
};

export class Enemy {
  constructor(scene, world, variant, wave) {
    this.scene = scene;
    this.world = world;
    this.variant = variant;
    this.config = VARIANT_CONFIG[variant];
    this.radius = 0.72;
    this.height = 1.3;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.desiredVelocity = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, 1);
    this.alive = true;
    this.alerted = false;
    this.wanderTarget = null;
    this.cooldown = 0;
    this.lostSightTimer = 0;

    this.maxHealth = this.config.health + Math.max(0, wave - 1) * 7;
    this.health = this.maxHealth;
    this.scoreValue = this.config.scoreValue + (wave - 1) * 10;
    this.attackRange = this.config.attackRange;

    this.group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.58, 0.9, 8, 16),
      new THREE.MeshStandardMaterial({
        color: this.config.color,
        emissive: this.config.emissive,
        emissiveIntensity: 0.4,
        metalness: 0.18,
        roughness: 0.36,
      })
    );
    body.castShadow = true;
    this.group.add(body);

    this.sensor = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.24, 0.9),
      new THREE.MeshStandardMaterial({
        color: '#061817',
        emissive: '#cffff6',
        emissiveIntensity: 0.18,
      })
    );
    this.sensor.position.set(0, 0.2, 0.85);
    this.group.add(this.sensor);

    this.scene.add(this.group);

    this.stateMachine = new StateMachine(this, new PatrolState());
    this.stateMachine.state.enter(this);
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

    const separation = this.computeSeparation();
    const avoidance = this.world.arena.getAvoidanceVector(this.position, this.desiredVelocity, 3.1);
    const steering = this.desiredVelocity.clone()
      .addScaledVector(separation, 4)
      .addScaledVector(avoidance, 6);

    if (steering.lengthSq() > 0.0001) {
      steering.normalize().multiplyScalar(this.config.speed);
      this.forward.lerp(steering.clone().normalize(), Math.min(1, dt * 8));
    }

    this.velocity.lerp(steering, Math.min(1, dt * 5));
    this.position.copy(this.world.arena.moveWithCollisions(this.position, this.velocity, this.radius, dt));
    this.syncVisuals();
  }

  syncVisuals() {
    this.group.position.set(this.position.x, this.height / 2, this.position.z);
    if (this.forward.lengthSq() > 0.001) {
      this.group.rotation.y = Math.atan2(this.forward.x, this.forward.z);
    }
  }

  canSeePlayer() {
    const player = this.world.player;
    const distance = this.position.distanceTo(player.position);
    if (distance > this.config.detectionRange) {
      return false;
    }

    return this.world.arena.hasLineOfSight(this.position, player.position);
  }

  pursuePlayer(weight = 1) {
    const desired = this.world.player.position.clone().sub(this.position).setY(0);
    if (desired.lengthSq() > 0.0001) {
      desired.normalize().multiplyScalar(weight);
    }

    this.desiredVelocity.copy(desired);
  }

  wander() {
    if (!this.wanderTarget || this.position.distanceTo(this.wanderTarget) < 1.5) {
      this.wanderTarget = this.world.arena.getRandomOpenPoint(this.position, 6);
    }

    const desired = this.wanderTarget.clone().sub(this.position).setY(0);
    if (desired.lengthSq() > 0.0001) {
      desired.normalize();
    }
    this.desiredVelocity.copy(desired);
  }

  computeSeparation() {
    const push = new THREE.Vector3();
    for (const other of this.world.enemies) {
      if (other === this || !other.alive) {
        continue;
      }

      const delta = this.position.clone().sub(other.position);
      const distance = delta.length();
      if (distance === 0 || distance > 2.2) {
        continue;
      }

      push.add(delta.normalize().multiplyScalar((2.2 - distance) / 2.2));
    }

    return push;
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
    scene.remove(this.group);
    this.group.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        child.material.dispose();
      }
    });
  }
}
