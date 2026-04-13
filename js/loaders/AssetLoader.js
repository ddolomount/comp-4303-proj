import { GLTFLoader } from "three/examples/jsm/Addons.js";

export class AssetLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();
    this.assets = {};
    this.loadPromise = null;
  }

  load(path) {
    // Return cached asset if it has already loaded
    if (this.cache.has(path)) {
      return Promise.resolve(this.cache.get(path));
    }

    // Load GLB file and cache it for later use
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
    // Load all game models used by entities and map obstacles
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
    // Reuse existing load promise if loading already started
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // Load assets and apply them to anything already spawned
    this.loadPromise = this.loadAll()
      .then((assets) => {
        this.assets = assets;
        this.applyLoadedAssets(world);
        return assets;
      })
      .catch((error) => {
        // Keep game running with fallback meshes if models fail to load
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
    // Update map obstacle visuals
    if (world.map) {
      world.map.setObstacleModelPack(this.assets.wallElements);
    }

    // Update player model
    if (world.player) {
      world.player.applyModelTemplate(this.getPlayerModel());
    }

    // Update enemy models
    for (let enemy of world.enemies) {
      enemy.applyModelTemplate(this.getEnemyModel(enemy.variant));
    }

    // Update pickup models
    for (let pickup of world.pickups) {
      pickup.applyModelTemplate(this.getPickupModel(pickup.type));
    }

    // Update protect objective model
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
