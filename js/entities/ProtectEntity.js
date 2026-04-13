import * as THREE from "three";
import { Entity } from "./Entity.js";
import { createModelInstance } from "../loaders/ModelUtils.js";

let HEALTH_BAR_WIDTH = 1.8;
let HEALTH_BAR_HEIGHT = 0.18;
let PROTECT_ENTITY_HEIGHT = 1.3;
let PROTECT_ENTITY_FOOTPRINT = 2.2;

export class ProtectEntity extends Entity {
  constructor(scene, modelTemplate = null) {
    super({
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(1.8, PROTECT_ENTITY_HEIGHT, 1.8),
      mesh: ProtectEntity.createMesh(modelTemplate)
    });

    this.scene = scene;
    this.radius = 0.7;
    this.maxHealth = 300;
    this.health = this.maxHealth;
    this.group = this.mesh;
    this.createHealthBar();
    this.updateHealthBar();

    this.scene.add(this.group);
    this.syncVisuals();
  }

  static createMesh(modelTemplate = null) {
    let group = new THREE.Group();

    // Try to create visual instance of model
    let { model } = createModelInstance(modelTemplate, {
      targetFootprint: PROTECT_ENTITY_FOOTPRINT
    });
    if (model) {
      model.position.y -= PROTECT_ENTITY_HEIGHT / 2;
      group.add(model);
      return group;
    }

    // Create default mesh if no model
    let body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.9, PROTECT_ENTITY_HEIGHT, 20),
      new THREE.MeshStandardMaterial({
        color: "#a813ce",
        emissive: "#a813ce",
        emissiveIntensity: 0.4,
        metalness: 0.28,
        roughness: 0.35
      })
    );

    body.castShadow = true;
    group.add(body);

    return group;
  }

  reset() {
    // Restore protect objective health
    this.health = this.maxHealth;
    this.updateHealthBar();
  }

  setPosition(x, z) {
    this.position.set(x, 0, z);
    this.syncVisuals();
  }

  syncVisuals() {
    // Position protect objective model
    this.group.position.set(this.position.x, this.scale.y / 2, this.position.z);
  }

  applyModelTemplate(modelTemplate) {
    // Build new model
    let mesh = ProtectEntity.createMesh(modelTemplate);

    // Replace current mesh with model
    this.replaceVisualMesh(mesh);
    this.syncVisuals();
  }

  replaceVisualMesh(newMesh) {
    this.clearVisualChildren();
    while (newMesh.children.length > 0) {
      this.group.add(newMesh.children[0]);
    }
  }

  clearVisualChildren() {
    let preserved = this.healthBarGroup
      ? new Set([this.healthBarGroup])
      : new Set();
    let children = [...this.group.children];
    for (let child of children) {
      if (preserved.has(child)) {
        continue;
      }
      this.group.remove(child);
      this.disposeObject3D(child);
    }
  }

  takeDamage(amount) {
    // Remove damage taken from health
    this.health = Math.max(0, this.health - amount);
    this.updateHealthBar();
  }

  createHealthBar() {
    // Create health bar above protect objective
    this.healthBarGroup = new THREE.Group();
    this.healthBarGroup.position.set(0, this.scale.y * 1.15, 0);
    this.healthBarGroup.rotation.x = -Math.PI / 2;

    let background = new THREE.Mesh(
      new THREE.PlaneGeometry(HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT),
      new THREE.MeshBasicMaterial({
        color: "#22081d",
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );

    let fill = new THREE.Mesh(
      new THREE.PlaneGeometry(
        HEALTH_BAR_WIDTH - 0.05,
        HEALTH_BAR_HEIGHT - 0.05
      ),
      new THREE.MeshBasicMaterial({
        color: "#d86bff",
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
    this.group.add(this.healthBarGroup);
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
      -((1 - ratio) * (HEALTH_BAR_WIDTH - 0.05)) / 2;
    this.healthBarGroup.visible = ratio > 0;

    if (ratio > 0.6) {
      this.healthBarFill.material.color.set("#d86bff");
    } else if (ratio > 0.3) {
      this.healthBarFill.material.color.set("#ffd85f");
    } else {
      this.healthBarFill.material.color.set("#ff6d6d");
    }
  }

  dispose(scene) {
    // Remove protect objective and dispose of model/mesh
    scene.remove(this.group);
    this.disposeObject3D(this.group);
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
}
