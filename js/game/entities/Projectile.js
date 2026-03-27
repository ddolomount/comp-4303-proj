import * as THREE from 'three';

export class Projectile {
  constructor(scene, { owner, position, direction, speed, damage, radius, lifetime, color }) {
    this.owner = owner;
    this.position = position.clone();
    this.velocity = direction.clone().normalize().multiplyScalar(speed);
    this.damage = damage;
    this.radius = radius;
    this.lifetime = lifetime;
    this.alive = true;

    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 12, 12),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.85,
        metalness: 0.1,
        roughness: 0.2,
      })
    );
    this.mesh.castShadow = true;
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  update(dt) {
    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.alive = false;
      return;
    }

    this.position.addScaledVector(this.velocity, dt);
    this.mesh.position.copy(this.position);
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
