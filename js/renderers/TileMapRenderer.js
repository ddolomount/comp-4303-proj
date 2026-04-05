import * as THREE from 'three';
import { Tile } from '../maps/Tile.js';

const FLOOR_Y = -0.5;
const GRID_LINE_COLOR = '#1fffc3';

// Tile map renderer
export class TileMapRenderer {

  // Constructor takes in a tile map
  constructor(tileMap) {
    this.map = tileMap;
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

    this.obstacleMesh = this.createObstacleMesh();
    if (this.obstacleMesh) {
      this.group.add(this.obstacleMesh);
    }
  }

  createFloor() {
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(this.map.width, 1, this.map.depth),
      new THREE.MeshStandardMaterial({
        color: '#0a1a17',
        emissive: '#0d3a30',
        emissiveIntensity: 0.35,
        metalness: 0.25,
        roughness: 0.92,
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
      opacity: 0.22,
    });

    for (let c = 0; c <= this.map.cols; c++) {
      const x = this.map.minX + c * this.map.tileSize;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.02, this.map.minZ),
        new THREE.Vector3(x, 0.02, this.map.maxZ),
      ]);
      group.add(new THREE.Line(geometry, material));
    }

    for (let r = 0; r <= this.map.rows; r++) {
      const z = this.map.minZ + r * this.map.tileSize;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(this.map.minX, 0.02, z),
        new THREE.Vector3(this.map.maxX, 0.02, z),
      ]);
      group.add(new THREE.Line(geometry, material));
    }

    return group;
  }

  createObstacleMesh() {
    if (this.obstacleCount === 0) {
      return null;
    }

    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: '#12312a',
        emissive: '#1fffc3',
        emissiveIntensity: 0.2,
        metalness: 0.2,
        roughness: 0.5,
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
      case Tile.Type.Ground: return new THREE.Color('#0a1a17');
      case Tile.Type.Obstacle: return new THREE.Color('#12312a');
      default: return new THREE.Color('black');
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
