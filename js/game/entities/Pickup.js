import * as THREE from 'three';

const PICKUP_CONFIG = {
  health: {
    color: '#ff7f73',
    emissive: '#ff6a5d',
    apply(player) {
      player.heal(28);
    },
  },
  multiplier: {
    color: '#ffd84f',
    emissive: '#ffd84f',
    apply(player) {
      player.addMultiplier(12);
    },
  },
};

export class Pickup {
  constructor(scene, type, position) {
    this.scene = scene;
    this.type = type;
    this.position = position.clone().setY(0.7);
    this.radius = 0.7;
    this.alive = true;
    this.age = 0;

    const config = PICKUP_CONFIG[type];
    this.config = config;
    this.mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.7, 0),
      new THREE.MeshStandardMaterial({
        color: config.color,
        emissive: config.emissive,
        emissiveIntensity: 0.55,
        metalness: 0.2,
        roughness: 0.3,
      })
    );
    this.mesh.position.copy(this.position);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }

  update(dt) {
    this.age += dt;
    this.mesh.position.y = this.position.y + Math.sin(this.age * 2.6) * 0.18;
    this.mesh.rotation.y += dt * 1.6;
  }

  apply(player) {
    this.config.apply(player);
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
