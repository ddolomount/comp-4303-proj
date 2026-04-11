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
          this.cache.set(path, gltf);
          resolve(gltf);
        },
        undefined,
        (error) => reject(error)
      );
    });
  }

  async loadAll() {
    const assets = {};
    assets.player = await this.load('/public/rodot_5000_-_flying_robot.glb');
    assets.meleeEnemy = await this.load('/public/chopper_robot_low_poly.glb');
    assets.rangedEnemy = await this.load('/public/dalek.glb');
    assets.healthPickup = await this.load('/public/health_pack.glb');
    assets.multiplierPickup = await this.load('/public/lightning_bolt.glb');
    assets.wallElements = await this.load('/public/set_of_electronic_elements_pack.glb');
    assets.protectEntity = await this.load('/public/intel_cpu.glb');
    return assets;
  }
}
