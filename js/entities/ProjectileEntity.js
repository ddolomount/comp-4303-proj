import * as THREE from "three";

let PROJECTILE_LENGTH_MULTIPLIER = 4.6;
let PROJECTILE_GLOW_MULTIPLIER = 0.75;
let PROJECTILE_CORE_MULTIPLIER = 0.38;
let PROJECTILE_FRONT_CAP_MULTIPLIER = 0.5;
let PROJECTILE_BACK_CAP_MULTIPLIER = 0.42;
let FORWARD_AXIS = new THREE.Vector3(0, 0, 1);

export class ProjectileEntity {
  constructor(
    scene,
    { owner, position, direction, speed, damage, radius, lifetime, color }
  ) {
    this.owner = owner;
    this.position = position.clone();
    this.velocity = direction.clone().normalize().multiplyScalar(speed);
    this.damage = damage;
    this.radius = radius;
    this.lifetime = lifetime;
    this.alive = true;
    this.direction = this.velocity.clone().normalize();

    let boltLength = radius * PROJECTILE_LENGTH_MULTIPLIER;
    let glowRadius = radius * PROJECTILE_GLOW_MULTIPLIER;
    this.mesh = new THREE.Group();

    // Create outer glow around projectile
    let glow = new THREE.Mesh(
      new THREE.CylinderGeometry(
        glowRadius,
        glowRadius,
        boltLength * 1.15,
        14,
        1,
        true
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    glow.rotation.x = Math.PI / 2;
    this.mesh.add(glow);

    // Create bright projectile core
    let core = new THREE.Mesh(
      new THREE.CylinderGeometry(
        radius * PROJECTILE_CORE_MULTIPLIER,
        radius * PROJECTILE_CORE_MULTIPLIER,
        boltLength,
        14
      ),
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: color,
        emissiveIntensity: 1.8,
        metalness: 0.05,
        roughness: 0.12
      })
    );
    core.rotation.x = Math.PI / 2;
    core.castShadow = true;
    this.mesh.add(core);

    // Create front glow cap
    let frontCap = new THREE.Mesh(
      new THREE.SphereGeometry(
        radius * PROJECTILE_FRONT_CAP_MULTIPLIER,
        12,
        12
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9
      })
    );
    frontCap.position.z = boltLength * 0.5;
    this.mesh.add(frontCap);

    // Create trailing glow cap
    let backCap = new THREE.Mesh(
      new THREE.SphereGeometry(radius * PROJECTILE_BACK_CAP_MULTIPLIER, 10, 10),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.45
      })
    );
    backCap.position.z = -boltLength * 0.35;
    this.mesh.add(backCap);

    // Point projectile mesh in travel direction
    this.mesh.quaternion.setFromUnitVectors(FORWARD_AXIS, this.direction);
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  update(dt) {
    // Count down projectile lifetime
    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.alive = false;
      return;
    }

    // Move projectile forward
    this.position.addScaledVector(this.velocity, dt);
    this.mesh.position.copy(this.position);
    this.mesh.quaternion.setFromUnitVectors(FORWARD_AXIS, this.direction);
  }

  dispose(scene) {
    // Remove projectile and dispose of mesh materials
    scene.remove(this.mesh);
    this.mesh.traverse((child) => {
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
}
