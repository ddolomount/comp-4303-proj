import { GLTFLoader } from "three/examples/jsm/Addons.js";

export class AssetLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();
    this.assets = {};
    this.loadPromise = null;
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
    let assets = {};
    assets.player = await this.load("/public/rodot_5000_-_flying_robot.glb");
    assets.meleeEnemy = await this.load("/public/chopper_robot_low_poly.glb");
    assets.rangedEnemy = await this.load("/public/dalek.glb");
    assets.healthPickup = await this.load("/public/health_pack.glb");
    assets.multiplierPickup = await this.load("/public/lightning_bolt.glb");
    assets.wallElements = await this.load(
      "/public/set_of_electronic_elements_pack.glb"
    );
    assets.protectEntity = await this.load("/public/intel_cpu.glb");
    return assets;
  }

  loadAssetsInBackground(world) {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.loadAll()
      .then((assets) => {
        this.assets = assets;
        this.applyLoadedAssets(world);
        return assets;
      })
      .catch((error) => {
        console.error(
          "Failed to load GLB assets, using fallback meshes instead.",
          error
        );
        this.assets = {};
        return {};
      });

    return this.loadPromise;
  }

  applyLoadedAssets(world) {
    if (world.map) {
      world.map.setObstacleModelPack(this.assets.wallElements);
    }

    if (world.player) {
      world.player.applyModelTemplate(this.getPlayerModel());
    }

    for (let enemy of world.enemies) {
      enemy.applyModelTemplate(this.getEnemyModel(enemy.variant));
    }

    for (let pickup of world.pickups) {
      pickup.applyModelTemplate(this.getPickupModel(pickup.type));
    }

    if (world.protectEntity) {
      world.protectEntity.applyModelTemplate(this.getProtectModel());
    }
  }

  getPlayerModel() {
    return this.assets?.player;
  }

  getEnemyModel(variant) {
    return variant === "melee"
      ? this.assets?.meleeEnemy
      : this.assets?.rangedEnemy;
  }

  getPickupModel(type) {
    return type === "health"
      ? this.assets?.healthPickup
      : this.assets?.multiplierPickup;
  }

  getProtectModel() {
    return this.assets?.protectEntity;
  }
}
