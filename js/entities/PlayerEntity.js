import * as THREE from "three";
import { Entity } from "./Entity.js";
import {
  createModelInstance,
  pickDefaultAnimationClip
} from "../loaders/ModelUtils.js";

let PLAYER_HEIGHT = 1.45;
let PLAYER_RADIUS = 0.78;

export class PlayerEntity extends Entity {
  constructor(scene, modelTemplate = null) {
    let { mesh, clips } = PlayerEntity.createMesh(modelTemplate);
    super({
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(2, PLAYER_HEIGHT, 2),
      mesh
    });

    this.scene = scene;
    this.radius = PLAYER_RADIUS;
    this.speed = 14;
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.fireRate = 0.18;
    this.fireCooldown = 0;
    this.multiplierTimer = 0;
    this.velocity = new THREE.Vector3();
    this.aimDirection = new THREE.Vector3(1, 0, 0);
    this.group = this.mesh;
    this.animationMixer = null;
    this.animationActions = new Map();
    this.activeAnimation = null;
    this.setupAnimations(clips);

    this.scene.add(this.group);
    this.syncVisuals();
  }

  static createMesh(modelTemplate) {
    let group = new THREE.Group();

    let { model, clips } = createModelInstance(modelTemplate, {
      targetHeight: PLAYER_HEIGHT,
      yaw: -Math.PI / 2
    });
    if (model) {
      group.add(model);
      return { mesh: group, clips };
    }

    let body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.9, PLAYER_HEIGHT, 20),
      new THREE.MeshStandardMaterial({
        color: "#a8fff0",
        emissive: "#35ffc7",
        emissiveIntensity: 0.4,
        metalness: 0.28,
        roughness: 0.35
      })
    );
    body.castShadow = true;
    group.add(body);

    let barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.24, 1.35),
      new THREE.MeshStandardMaterial({
        color: "#0d1e1c",
        emissive: "#58ffd4",
        emissiveIntensity: 0.26,
        metalness: 0.45,
        roughness: 0.25
      })
    );
    barrel.position.set(0, 0.4, 0.8);
    group.add(barrel);

    return { mesh: group, clips: [] };
  }

  setupAnimations(clips) {
    this.resetAnimations();

    if (!clips?.length) {
      return;
    }

    this.animationMixer = new THREE.AnimationMixer(this.group);
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
      this.animationMixer.uncacheRoot(this.group);
    }

    this.animationMixer = null;
    this.animationActions = new Map();
    this.activeAnimation = null;
  }

  applyModelTemplate(modelTemplate) {
    let { mesh, clips } = PlayerEntity.createMesh(modelTemplate);
    this.replaceVisualMesh(mesh);
    this.setupAnimations(clips);
    this.syncVisuals();
  }

  replaceVisualMesh(newMesh) {
    this.clearVisualChildren();
    while (newMesh.children.length > 0) {
      this.group.add(newMesh.children[0]);
    }
  }

  clearVisualChildren() {
    while (this.group.children.length > 0) {
      let child = this.group.children[0];
      this.group.remove(child);
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

  reset() {
    this.health = this.maxHealth;
    this.fireCooldown = 0;
    this.multiplierTimer = 0;
    this.velocity.set(0, 0, 0);
  }

  setPosition(x, z) {
    this.position.set(x, 0, z);
    this.syncVisuals();
  }

  update(dt, input, world) {
    if (this.animationMixer) {
      this.animationMixer.update(dt);
    }

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.multiplierTimer = Math.max(0, this.multiplierTimer - dt);

    let movement = input.getMovementVector().multiplyScalar(this.speed);
    this.velocity.copy(movement);
    this.position.copy(
      world.map.moveWithCollisions(this.position, movement, this.radius, dt)
    );

    let aim = input.pointerWorld.clone().sub(this.position);
    aim.y = 0;
    if (aim.lengthSq() > 0.0001) {
      this.aimDirection.copy(aim.normalize());
    }

    if (input.mouseDown && this.fireCooldown === 0) {
      this.fireCooldown = this.fireRate;
      world.addProjectile({
        owner: "player",
        position: this.position
          .clone()
          .addScaledVector(this.aimDirection, 1.2)
          .setY(0.5),
        direction: this.aimDirection.clone(),
        speed: 28,
        damage: 22,
        radius: 0.22,
        lifetime: 1.2,
        color: "#73ffe1"
      });
    }

    this.syncVisuals();
  }

  syncVisuals() {
    this.group.position.set(
      this.position.x,
      PLAYER_HEIGHT / 2,
      this.position.z
    );
    let yaw = Math.atan2(this.aimDirection.x, this.aimDirection.z);
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

  dispose(scene) {
    scene.remove(this.group);
    this.resetAnimations();
    this.disposeObject3D(this.group);
  }
}
