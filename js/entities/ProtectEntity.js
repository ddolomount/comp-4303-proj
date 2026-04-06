import * as THREE from 'three';
import { Entity } from './Entity.js';

export class ProtectEntity extends Entity {
  constructor(scene) {
    super({
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(1.8, 1.3, 1.8),
      mesh: ProtectEntity.createMesh(),
    });

    this.scene = scene;
    this.radius = 0.7;
    this.maxHealth = 300;
    this.health = this.maxHealth;
    this.group = this.mesh;

    this.scene.add(this.group);
    this.syncVisuals();
  }

  static createMesh() {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.9, 1.3, 20),
      new THREE.MeshStandardMaterial({
        color: '#a813ce',
        emissive: '#a813ce',
        emissiveIntensity: 0.4,
        metalness: 0.28,
        roughness: 0.35,
      })
    );

    body.castShadow = true;
    group.add(body);

    return group;
  }

  reset() {
    this.health = this.maxHealth;
  }

  setPosition(x, z) {
    this.position.set(x, 0, z);
    this.syncVisuals();
  }

  syncVisuals() {
    this.group.position.set(this.position.x, this.scale.y / 2, this.position.z);
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
  }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((child) => {
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
