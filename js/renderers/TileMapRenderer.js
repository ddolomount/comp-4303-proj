import * as THREE from "three";
import { Tile } from "../maps/Tile.js";

const FLOOR_Y = -0.5;
const GRID_LINE_COLOR = "#1fffc3";
const OBSTACLE_BASE_Y = 0.045;
const OBSTACLE_GLOW_Y = 0.055;
const WALL_MODEL_FOOTPRINT = 0.86;
const WALL_MODEL_HEIGHT = 0.95;

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
        const tile = this.map.grid[r][c];
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
    const floor = new THREE.Mesh(
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
    const group = new THREE.Group();
    const material = new THREE.LineBasicMaterial({
      color: GRID_LINE_COLOR,
      transparent: true,
      opacity: 0.22
    });

    for (let c = 0; c <= this.map.cols; c++) {
      const x = this.map.minX + c * this.map.tileSize;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.02, this.map.minZ),
        new THREE.Vector3(x, 0.02, this.map.maxZ)
      ]);
      group.add(new THREE.Line(geometry, material));
    }

    for (let r = 0; r <= this.map.rows; r++) {
      const z = this.map.minZ + r * this.map.tileSize;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(this.map.minX, 0.02, z),
        new THREE.Vector3(this.map.maxX, 0.02, z)
      ]);
      group.add(new THREE.Line(geometry, material));
    }

    return group;
  }

  extractObstacleVariants(modelPack) {
    const source = modelPack?.scene ?? modelPack;
    if (!source) {
      return [];
    }

    source.updateMatrixWorld(true);
    const elementRoots = this.getObstacleElementRoots(source);
    const elementGroups = this.getObstacleElementGroups(elementRoots);
    const variants = [];
    for (const elementGroup of elementGroups) {
      const parts = [];
      const variantBounds = new THREE.Box3();

      for (const root of elementGroup) {
        root.traverse((child) => {
          if (!child.isMesh || !child.geometry) {
            return;
          }

          const geometry = child.geometry.clone();
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
        for (const part of parts) {
          part.geometry.dispose();
          this.disposeMaterial(part.material);
        }
        continue;
      }

      const center = new THREE.Vector3();
      variantBounds.getCenter(center);

      for (const part of parts) {
        part.geometry.translate(-center.x, -variantBounds.min.y, -center.z);
        part.geometry.computeBoundingBox();
      }

      const size = new THREE.Vector3();
      variantBounds.getSize(size);
      variants.push({
        parts,
        size
      });
    }

    return variants;
  }

  getObstacleElementRoots(source) {
    const root =
      source.getObjectByName("GLTF_SceneRootNode") ??
      this.findElementRoot(source);
    const candidates = root.children.length > 0 ? root.children : [root];
    return candidates.filter((child) => this.containsMesh(child));
  }

  getObstacleElementGroups(elementRoots) {
    const electronicPackGroups =
      this.getElectronicPackElementGroups(elementRoots);
    if (electronicPackGroups) {
      return electronicPackGroups;
    }

    return this.clusterObstacleElements(elementRoots).map(
      (cluster) => cluster.roots
    );
  }

  getElectronicPackElementGroups(elementRoots) {
    const firstName = elementRoots[0]?.name ?? "";
    const lastName = elementRoots[elementRoots.length - 1]?.name ?? "";
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
    const clusters = [];

    for (const root of elementRoots) {
      const bounds = new THREE.Box3().setFromObject(root);
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

    const group = new THREE.Group();
    const variantMatrices = new Map();

    for (let r = 0; r < this.map.rows; r++) {
      for (let c = 0; c < this.map.cols; c++) {
        const tile = this.map.grid[r][c];
        if (tile.isWalkable()) {
          continue;
        }

        const variantIndex = this.pickVariantIndex(
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

    for (const [variantIndex, matrices] of variantMatrices.entries()) {
      const variant = this.obstacleVariants[variantIndex];
      for (const part of variant.parts) {
        const mesh = new THREE.InstancedMesh(
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

    const group = new THREE.Group();
    const baseMesh = new THREE.InstancedMesh(
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
    const glowMesh = new THREE.InstancedMesh(
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
    const baseMatrix = new THREE.Matrix4();
    const glowMatrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2
    );
    let index = 0;

    for (let r = 0; r < this.map.rows; r += 1) {
      for (let c = 0; c < this.map.cols; c += 1) {
        const tile = this.map.grid[r][c];
        if (tile.isWalkable()) {
          continue;
        }

        const pos = this.map.localize(tile);
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

    const mesh = new THREE.InstancedMesh(
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
        const tile = this.map.grid[r][c];
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
    const seed = (tile.row * 73856093) ^ (tile.col * 19349663);
    return ((seed % variantCount) + variantCount) % variantCount;
  }

  getModelTileTransformation(tile, variant) {
    const pos = this.map.localize(tile);
    pos.y = FLOOR_Y;

    const rotation = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.getTileRotation(tile)
    );
    const scale = this.getModelTileScale(tile, variant);
    const matrix = new THREE.Matrix4();
    matrix.compose(pos, rotation, new THREE.Vector3(scale, scale, scale));
    return matrix;
  }

  getTileRotation(tile) {
    return ((tile.row * 17 + tile.col * 31) % 4) * (Math.PI / 2);
  }

  getModelTileScale(tile, variant) {
    const footprint = Math.max(variant.size.x, variant.size.z, 0.0001);
    const height = Math.max(variant.size.y, 0.0001);
    const footprintScale =
      (this.map.tileSize * WALL_MODEL_FOOTPRINT) / footprint;
    const heightScale = (tile.height * WALL_MODEL_HEIGHT) / height;
    return Math.min(footprintScale, heightScale);
  }

  getTileTransformation(tile) {
    const pos = this.map.localize(tile);
    pos.y = tile.height / 2 + FLOOR_Y;

    const matrix = new THREE.Matrix4();
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
        const current = this.map.grid[r][c];
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
