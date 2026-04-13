import * as THREE from "three";
import { Entity } from "./Entity.js";
import {
  createModelInstance,
  pickDefaultAnimationClip
} from "../loaders/ModelUtils.js";

let PICKUP_CONFIG = {
  health: {
    color: "#ff7f73",
    emissive: "#ff6a5d",
    modelHeight: 0.72,
    apply(player) {
      player.heal(28);
    }
  },
  multiplier: {
    color: "#ffd84f",
    emissive: "#ffd84f",
    modelHeight: 1.45,
    apply(player) {
      player.addMultiplier(12);
    }
  }
};

export class PickupEntity extends Entity {
  constructor(scene, type, position, modelTemplate = null) {
    let config = PICKUP_CONFIG[type];
    let basePosition = position.clone().setY(0.7);
    let { mesh, clips } = PickupEntity.createMesh(config, modelTemplate);

    super({
      position: basePosition,
      scale: new THREE.Vector3(1.4, 1.4, 1.4),
      mesh
    });

    this.scene = scene;
    this.type = type;
    this.config = config;
    this.radius = 0.7;
    this.alive = true;
    this.age = 0;
    this.animationMixer = null;
    this.animationActions = new Map();
    this.activeAnimation = null;
    this.setupAnimations(clips);

    this.mesh.castShadow = true;
    this.scene.add(this.mesh);
  }

  static createMesh(config, modelTemplate) {
    let group = new THREE.Group();

    let { model, clips } = createModelInstance(modelTemplate, {
      targetHeight: config.modelHeight ?? 1.05
    });
    if (model) {
      if (config === PICKUP_CONFIG.multiplier) {
        model.rotation.x = Math.PI / 2;
      }
      group.add(model);
      return { mesh: group, clips };
    }

    let mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.7, 0),
      new THREE.MeshStandardMaterial({
        color: config.color,
        emissive: config.emissive,
        emissiveIntensity: 0.55,
        metalness: 0.2,
        roughness: 0.3
      })
    );
    mesh.castShadow = true;
    group.add(mesh);
    return { mesh: group, clips: [] };
  }

  setupAnimations(clips) {
    this.resetAnimations();

    if (!clips?.length) {
      return;
    }

    this.animationMixer = new THREE.AnimationMixer(this.mesh);
    for (let clip of clips) {
      this.animationActions.set(
        clip.name,
        this.animationMixer.clipAction(clip)
      );
    }

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

    for (let action of this.animationActions.values()) {
      action.stop();
    }

    let action = this.animationActions.get(name);
    action.reset();
    action.play();
    this.activeAnimation = name;
  }

  resetAnimations() {
    if (this.animationMixer) {
      this.animationMixer.stopAllAction();
      this.animationMixer.uncacheRoot(this.mesh);
    }

    this.animationMixer = null;
    this.animationActions = new Map();
    this.activeAnimation = null;
  }

  applyModelTemplate(modelTemplate) {
    let { mesh, clips } = PickupEntity.createMesh(this.config, modelTemplate);
    this.replaceVisualMesh(mesh);
    this.setupAnimations(clips);
  }

  replaceVisualMesh(newMesh) {
    this.clearVisualChildren();
    while (newMesh.children.length > 0) {
      this.mesh.add(newMesh.children[0]);
    }
  }

  clearVisualChildren() {
    while (this.mesh.children.length > 0) {
      let child = this.mesh.children[0];
      this.mesh.remove(child);
      this.disposeObject3D(child);
    }
  }

  disposeObject3D(object) {
    object.traverse((child) => {
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

  update(dt) {
    this.age += dt;
    if (this.animationMixer) {
      this.animationMixer.update(dt);
    }
    this.mesh.position.y = this.position.y + Math.sin(this.age * 2.6) * 0.18;
    this.mesh.rotation.y += dt * 1.6;
  }

  apply(player) {
    this.config.apply(player);
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.resetAnimations();
    this.disposeObject3D(this.mesh);
  }
}
