import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';

export class AssetLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();
  }

  load(path) {
    if (this.cache.has(path)) {
      return Promise.resolve(this.cache.get(path));
    }

    return new Promise((resolve, reject) => {
      this.loader.load(
        path,
        (gltf) => {
          this.cache.set(path, gltf.scene);
          resolve(gltf.scene);
        },
        undefined,
        (error) => reject(error)
      );
    });
  }

  async loadAll() {
    const assets = {};
    assets.player = await this.load('rodot_5000_-_flying_robot.glb');
    assets.meleeEnemy = await this.load('chopper_robot_low_poly.glb');
    assets.rangedEnemy = await this.load('dalek.glb');
    return assets;
  }
}