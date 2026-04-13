import * as THREE from "three";
import { Tile } from "../maps/Tile.js";

let FLOOR_Y = -0.5;
let GRID_LINE_COLOR = "#1fffc3";
let OBSTACLE_BASE_Y = 0.045;
let OBSTACLE_GLOW_Y = 0.055;
let WALL_MODEL_FOOTPRINT = 0.86;
let WALL_MODEL_HEIGHT = 0.95;

// Tile map renderer
export class TileMapRenderer {
  // Constructor takes in a tile map
  constructor(tileMap, obstacleModelPack = null) {
    this.map = tileMap;
    this.obstacleModelPack = obstacleModelPack;
    this.obstacleVariants = this.extractObstacleVariants(obstacleModelPack);
    this.group = new THREE.Group();

    // Count the obstacle tiles for the instanced wall mesh.
    this.obstacleCount = 0;
    for (let r = 0; r < this.map.rows; r++) {
      for (let c = 0; c < this.map.cols; c++) {
        let tile = this.map.grid[r][c];
        if (!tile.isWalkable()) {
          this.obstacleCount++;
        }
      }
    }

    this.floor = this.createFloor();
    this.group.add(this.floor);

    this.gridLines = this.createGridLines();
    this.group.add(this.gridLines);

    this.obstacleGroup = this.createObstacleModelGroup();
    this.obstacleMesh = this.obstacleGroup ? null : this.createObstacleMesh();
    if (this.obstacleGroup) {
      this.obstacleBaseGroup = this.createObstacleBaseGroup();
      if (this.obstacleBaseGroup) {
        this.group.add(this.obstacleBaseGroup);
      }
      this.group.add(this.obstacleGroup);
    } else if (this.obstacleMesh) {
      this.group.add(this.obstacleMesh);
    }
  }

  createFloor() {
    let floor = new THREE.Mesh(
      new THREE.BoxGeometry(this.map.width, 1, this.map.depth),
      new THREE.MeshStandardMaterial({
        color: "#0a1a17",
        emissive: "#0d3a30",
        emissiveIntensity: 0.35,
        metalness: 0.25,
        roughness: 0.92
      })
    );
    floor.position.set(0, FLOOR_Y, 0);
    floor.receiveShadow = true;
    return floor;
  }

  createGridLines() {
    let group = new THREE.Group();
    let material = new THREE.LineBasicMaterial({
      color: GRID_LINE_COLOR,
      transparent: true,
      opacity: 0.22
    });

    for (let c = 0; c <= this.map.cols; c++) {
      let x = this.map.minX + c * this.map.tileSize;
      let geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.02, this.map.minZ),
        new THREE.Vector3(x, 0.02, this.map.maxZ)
      ]);
      group.add(new THREE.Line(geometry, material));
    }

    for (let r = 0; r <= this.map.rows; r++) {
      let z = this.map.minZ + r * this.map.tileSize;
      let geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(this.map.minX, 0.02, z),
        new THREE.Vector3(this.map.maxX, 0.02, z)
      ]);
      group.add(new THREE.Line(geometry, material));
    }

    return group;
  }

  extractObstacleVariants(modelPack) {
    let source = modelPack?.scene ?? modelPack;
    if (!source) {
      return [];
    }

    source.updateMatrixWorld(true);
    let elementRoots = this.getObstacleElementRoots(source);
    let elementGroups = this.getObstacleElementGroups(elementRoots);
    let variants = [];
    for (let elementGroup of elementGroups) {
      let parts = [];
      let variantBounds = new THREE.Box3();

      for (let root of elementGroup) {
        root.traverse((child) => {
          if (!child.isMesh || !child.geometry) {
            return;
          }

          let geometry = child.geometry.clone();
          geometry.applyMatrix4(child.matrixWorld);
          geometry.computeBoundingBox();

          if (!geometry.boundingBox || geometry.boundingBox.isEmpty()) {
            geometry.dispose();
            return;
          }

          variantBounds.union(geometry.boundingBox);
          parts.push({
            geometry,
            material: this.cloneMaterial(child.material)
          });
        });
      }

      if (parts.length === 0 || variantBounds.isEmpty()) {
        for (let part of parts) {
          part.geometry.dispose();
          this.disposeMaterial(part.material);
        }
        continue;
      }

      let center = new THREE.Vector3();
      variantBounds.getCenter(center);

      for (let part of parts) {
        part.geometry.translate(-center.x, -variantBounds.min.y, -center.z);
        part.geometry.computeBoundingBox();
      }

      let size = new THREE.Vector3();
      variantBounds.getSize(size);
      variants.push({
        parts,
        size
      });
    }

    return variants;
  }

  getObstacleElementRoots(source) {
    let root =
      source.getObjectByName("GLTF_SceneRootNode") ??
      this.findElementRoot(source);
    let candidates = root.children.length > 0 ? root.children : [root];
    return candidates.filter((child) => this.containsMesh(child));
  }

  getObstacleElementGroups(elementRoots) {
    let electronicPackGroups =
      this.getElectronicPackElementGroups(elementRoots);
    if (electronicPackGroups) {
      return electronicPackGroups;
    }

    return this.clusterObstacleElements(elementRoots).map(
      (cluster) => cluster.roots
    );
  }

  getElectronicPackElementGroups(elementRoots) {
    let firstName = elementRoots[0]?.name ?? "";
    let lastName = elementRoots[elementRoots.length - 1]?.name ?? "";
    if (
      elementRoots.length !== 81 ||
      !firstName.startsWith("anode") ||
      !lastName.startsWith("Plane020")
    ) {
      return null;
    }

    return [
      elementRoots.slice(0, 6),
      elementRoots.slice(6, 13),
      elementRoots.slice(13, 23),
      elementRoots.slice(23, 33),
      [...elementRoots.slice(33, 36), ...elementRoots.slice(63, 81)],
      elementRoots.slice(36, 43),
      elementRoots.slice(43, 49),
      elementRoots.slice(49, 56),
      elementRoots.slice(56, 63)
    ];
  }

  findElementRoot(source) {
    let current = source;
    while (
      current.children.length === 1 &&
      !current.isMesh &&
      current.children[0].children.length > 0
    ) {
      current = current.children[0];
    }

    return current;
  }

  containsMesh(object) {
    let found = false;
    object.traverse((child) => {
      if (child.isMesh) {
        found = true;
      }
    });
    return found;
  }

  clusterObstacleElements(elementRoots) {
    let clusters = [];

    for (let root of elementRoots) {
      let bounds = new THREE.Box3().setFromObject(root);
      if (bounds.isEmpty()) {
        continue;
      }

      let cluster = clusters.find((candidate) =>
        this.boundsOverlap(candidate.bounds, bounds)
      );
      if (!cluster) {
        cluster = {
          bounds: bounds.clone(),
          roots: []
        };
        clusters.push(cluster);
      }

      cluster.bounds.union(bounds);
      cluster.roots.push(root);
    }

    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < clusters.length; i += 1) {
        for (let j = i + 1; j < clusters.length; j += 1) {
          if (!this.boundsOverlap(clusters[i].bounds, clusters[j].bounds)) {
            continue;
          }

          clusters[i].bounds.union(clusters[j].bounds);
          clusters[i].roots.push(...clusters[j].roots);
          clusters.splice(j, 1);
          merged = true;
          break;
        }

        if (merged) {
          break;
        }
      }
    }

    return clusters;
  }

  boundsOverlap(a, b) {
    return (
      a.min.x <= b.max.x &&
      a.max.x >= b.min.x &&
      a.min.y <= b.max.y &&
      a.max.y >= b.min.y &&
      a.min.z <= b.max.z &&
      a.max.z >= b.min.z
    );
  }

  cloneMaterial(material) {
    if (Array.isArray(material)) {
      return material.map((item) => item.clone());
    }

    return (
      material?.clone?.() ??
      new THREE.MeshStandardMaterial({
        color: "#12312a",
        emissive: "#1fffc3",
        emissiveIntensity: 0.2,
        metalness: 0.2,
        roughness: 0.5
      })
    );
  }

  disposeMaterial(material) {
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
      return;
    }

    material?.dispose?.();
  }

  createObstacleModelGroup() {
    if (this.obstacleCount === 0 || this.obstacleVariants.length === 0) {
      return null;
    }

    let group = new THREE.Group();
    let variantMatrices = new Map();

    for (let r = 0; r < this.map.rows; r++) {
      for (let c = 0; c < this.map.cols; c++) {
        let tile = this.map.grid[r][c];
        if (tile.isWalkable()) {
          continue;
        }

        let variantIndex = this.pickVariantIndex(
          tile,
          this.obstacleVariants.length
        );
        if (!variantMatrices.has(variantIndex)) {
          variantMatrices.set(variantIndex, []);
        }

        variantMatrices
          .get(variantIndex)
          .push(
            this.getModelTileTransformation(
              tile,
              this.obstacleVariants[variantIndex]
            )
          );
      }
    }

    for (let [variantIndex, matrices] of variantMatrices.entries()) {
      let variant = this.obstacleVariants[variantIndex];
      for (let part of variant.parts) {
        let mesh = new THREE.InstancedMesh(
          part.geometry,
          part.material,
          matrices.length
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        for (let i = 0; i < matrices.length; i += 1) {
          mesh.setMatrixAt(i, matrices[i]);
        }

        mesh.instanceMatrix.needsUpdate = true;
        group.add(mesh);
      }
    }

    return group;
  }

  createObstacleBaseGroup() {
    if (this.obstacleCount === 0 || this.obstacleVariants.length === 0) {
      return null;
    }

    let group = new THREE.Group();
    let baseMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({
        color: "#06110f",
        emissive: "#18ffd0",
        emissiveIntensity: 0.12,
        metalness: 0.25,
        roughness: 0.7,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide
      }),
      this.obstacleCount
    );
    let glowMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: "#36ffd8",
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      this.obstacleCount
    );
    let baseMatrix = new THREE.Matrix4();
    let glowMatrix = new THREE.Matrix4();
    let rotation = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2
    );
    let index = 0;

    for (let r = 0; r < this.map.rows; r += 1) {
      for (let c = 0; c < this.map.cols; c += 1) {
        let tile = this.map.grid[r][c];
        if (tile.isWalkable()) {
          continue;
        }

        let pos = this.map.localize(tile);
        baseMatrix.compose(
          new THREE.Vector3(pos.x, OBSTACLE_BASE_Y, pos.z),
          rotation,
          new THREE.Vector3(
            this.map.tileSize * 0.86,
            this.map.tileSize * 0.86,
            1
          )
        );
        glowMatrix.compose(
          new THREE.Vector3(pos.x, OBSTACLE_GLOW_Y, pos.z),
          rotation,
          new THREE.Vector3(
            this.map.tileSize * 1.08,
            this.map.tileSize * 1.08,
            1
          )
        );
        baseMesh.setMatrixAt(index, baseMatrix);
        glowMesh.setMatrixAt(index, glowMatrix);
        index += 1;
      }
    }

    baseMesh.receiveShadow = true;
    baseMesh.renderOrder = 1;
    glowMesh.renderOrder = 2;
    baseMesh.instanceMatrix.needsUpdate = true;
    glowMesh.instanceMatrix.needsUpdate = true;
    group.add(glowMesh);
    group.add(baseMesh);
    return group;
  }

  createObstacleMesh() {
    if (this.obstacleCount === 0) {
      return null;
    }

    let mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: "#12312a",
        emissive: "#1fffc3",
        emissiveIntensity: 0.2,
        metalness: 0.2,
        roughness: 0.5
      }),
      this.obstacleCount
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    let index = 0;
    for (let r = 0; r < this.map.rows; r++) {
      for (let c = 0; c < this.map.cols; c++) {
        let tile = this.map.grid[r][c];
        if (tile.isWalkable()) {
          continue;
        }

        mesh.setMatrixAt(index, this.getTileTransformation(tile));
        mesh.setColorAt(index, this.getTileColor(tile));
        index++;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    return mesh;
  }

  pickVariantIndex(tile, variantCount) {
    let seed = (tile.row * 73856093) ^ (tile.col * 19349663);
    return ((seed % variantCount) + variantCount) % variantCount;
  }

  getModelTileTransformation(tile, variant) {
    let pos = this.map.localize(tile);
    pos.y = FLOOR_Y;

    let rotation = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.getTileRotation(tile)
    );
    let scale = this.getModelTileScale(tile, variant);
    let matrix = new THREE.Matrix4();
    matrix.compose(pos, rotation, new THREE.Vector3(scale, scale, scale));
    return matrix;
  }

  getTileRotation(tile) {
    return ((tile.row * 17 + tile.col * 31) % 4) * (Math.PI / 2);
  }

  getModelTileScale(tile, variant) {
    let footprint = Math.max(variant.size.x, variant.size.z, 0.0001);
    let height = Math.max(variant.size.y, 0.0001);
    let footprintScale = (this.map.tileSize * WALL_MODEL_FOOTPRINT) / footprint;
    let heightScale = (tile.height * WALL_MODEL_HEIGHT) / height;
    return Math.min(footprintScale, heightScale);
  }

  getTileTransformation(tile) {
    let pos = this.map.localize(tile);
    pos.y = tile.height / 2 + FLOOR_Y;

    let matrix = new THREE.Matrix4();
    matrix.makeScale(this.map.tileSize, tile.height, this.map.tileSize);
    matrix.setPosition(pos);
    return matrix;
  }

  getTileColor(tile) {
    switch (tile.type) {
      case Tile.Type.Ground:
        return new THREE.Color("#0a1a17");
      case Tile.Type.Obstacle:
        return new THREE.Color("#12312a");
      default:
        return new THREE.Color("black");
    }
  }

  setTileColor(tile, color) {
    if (!this.obstacleMesh || tile.isWalkable()) {
      return;
    }

    let index = 0;
    for (let r = 0; r < this.map.rows; r++) {
      for (let c = 0; c < this.map.cols; c++) {
        let current = this.map.grid[r][c];
        if (current.isWalkable()) {
          continue;
        }

        if (current === tile) {
          this.obstacleMesh.setColorAt(index, color);
          if (this.obstacleMesh.instanceColor) {
            this.obstacleMesh.instanceColor.needsUpdate = true;
          }
          return;
        }

        index++;
      }
    }
  }

  render(scene) {
    scene.add(this.group);
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
