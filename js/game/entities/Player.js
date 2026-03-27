import * as THREE from 'three';

const PLAYER_HEIGHT = 1.3;

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.radius = 0.7;
    this.speed = 14;
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.fireRate = 0.18;
    this.fireCooldown = 0;
    this.multiplierTimer = 0;

    this.position = new THREE.Vector3();
    this.aimDirection = new THREE.Vector3(1, 0, 0);

    this.group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.9, PLAYER_HEIGHT, 20),
      new THREE.MeshStandardMaterial({
        color: '#a8fff0',
        emissive: '#35ffc7',
        emissiveIntensity: 0.4,
        metalness: 0.28,
        roughness: 0.35,
      })
    );
    body.castShadow = true;
    this.group.add(body);

    this.barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.24, 1.35),
      new THREE.MeshStandardMaterial({
        color: '#0d1e1c',
        emissive: '#58ffd4',
        emissiveIntensity: 0.26,
        metalness: 0.45,
        roughness: 0.25,
      })
    );
    this.barrel.position.set(0, 0.4, 0.8);
    this.group.add(this.barrel);

    this.scene.add(this.group);
    this.syncVisuals();
  }

  reset() {
    this.health = this.maxHealth;
    this.fireCooldown = 0;
    this.multiplierTimer = 0;
  }

  setPosition(x, z) {
    this.position.set(x, 0, z);
    this.syncVisuals();
  }

  update(dt, input, world) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.multiplierTimer = Math.max(0, this.multiplierTimer - dt);

    const movement = input.getMovementVector().multiplyScalar(this.speed);
    this.position.copy(world.arena.moveWithCollisions(this.position, movement, this.radius, dt));

    const aim = input.pointerWorld.clone().sub(this.position);
    aim.y = 0;
    if (aim.lengthSq() > 0.0001) {
      this.aimDirection.copy(aim.normalize());
    }

    if (input.mouseDown && this.fireCooldown === 0) {
      this.fireCooldown = this.fireRate;
      world.addProjectile({
        owner: 'player',
        position: this.position.clone().addScaledVector(this.aimDirection, 1.2).setY(0.5),
        direction: this.aimDirection.clone(),
        speed: 28,
        damage: 22,
        radius: 0.22,
        lifetime: 1.2,
        color: '#73ffe1',
      });
    }

    this.syncVisuals();
  }

  syncVisuals() {
    this.group.position.set(this.position.x, PLAYER_HEIGHT / 2, this.position.z);
    const yaw = Math.atan2(this.aimDirection.x, this.aimDirection.z);
    this.group.rotation.y = yaw;
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  addMultiplier(duration) {
    this.multiplierTimer = Math.max(this.multiplierTimer, duration);
  }

  getScoreMultiplier() {
    return this.multiplierTimer > 0 ? 2 : 1;
  }
}
