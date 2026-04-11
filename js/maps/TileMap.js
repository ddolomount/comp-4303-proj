import * as THREE from "three";
import { Tile } from "./Tile.js";
import { LevelMap } from "./LevelMap.js";
import { CaveGenerator } from "../pcg/CaveGenerator.js";
import { TileMapRenderer } from "../renderers/TileMapRenderer.js";

const CA_ITERATIONS = 20;
const CA_DENSITY = 0.45;

export class TileMap extends LevelMap {
  constructor(scene, { rows = 31, cols = 31, tileSize = 3 } = {}) {
    super({
      width: cols * tileSize,
      depth: rows * tileSize
    });

    this.scene = scene;
    this.rows = rows;
    this.cols = cols;
    this.tileSize = tileSize;
    this.grid = [];
    this.center = new THREE.Vector3();
    this.renderer = null;
    this.obstacleModelPack = null;
    this.generate();
  }

  generate() {
    this.generateGrid();
    this.walkableTiles = this.grid.flat().filter((tile) => tile.isWalkable());

    const spawnTile = this.findCentralWalkableTile();
    const spawnPoint = this.localize(spawnTile);
    this.center.set(spawnPoint.x, 0, spawnPoint.z);

    if (this.renderer) {
      this.renderer.dispose(this.scene);
    }

    this.renderer = new TileMapRenderer(this, this.obstacleModelPack);
    this.renderer.render(this.scene);
  }

  setObstacleModelPack(modelPack) {
    this.obstacleModelPack = modelPack;

    if (!this.renderer) {
      return;
    }

    this.renderer.dispose(this.scene);
    this.renderer = new TileMapRenderer(this, this.obstacleModelPack);
    this.renderer.render(this.scene);
  }

  generateGrid() {
    const gridCA = CaveGenerator.generate(this, CA_ITERATIONS, CA_DENSITY);
    this.grid = [];

    for (let r = 0; r < this.rows; r += 1) {
      let row = [];
      for (let c = 0; c < this.cols; c += 1) {
        let isObstacle = gridCA[r][c] === 1;
        row.push(
          new Tile(
            r,
            c,
            isObstacle ? Tile.Type.Obstacle : Tile.Type.Ground,
            isObstacle ? 3.4 : 1
          )
        );
      }
      this.grid.push(row);
    }
  }

  findCentralWalkableTile() {
    if (this.walkableTiles.length === 0) {
      return this.grid[Math.floor(this.rows / 2)][Math.floor(this.cols / 2)];
    }

    const centerRow = Math.floor(this.rows / 2);
    const centerCol = Math.floor(this.cols / 2);
    let bestTile = this.walkableTiles[0];
    let bestDistance = Infinity;

    for (const tile of this.walkableTiles) {
      const distance =
        Math.abs(tile.row - centerRow) + Math.abs(tile.col - centerCol);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestTile = tile;
      }
    }

    return bestTile;
  }

  getNeighbours(tile) {
    const neighbours = [];
    const { row, col } = tile;

    if (this.isWalkable(row - 1, col) && !tile.walls.north) {
      neighbours.push(this.grid[row - 1][col]);
    }

    if (this.isWalkable(row + 1, col) && !tile.walls.south) {
      neighbours.push(this.grid[row + 1][col]);
    }

    if (this.isWalkable(row, col + 1) && !tile.walls.east) {
      neighbours.push(this.grid[row][col + 1]);
    }

    if (this.isWalkable(row, col - 1) && !tile.walls.west) {
      neighbours.push(this.grid[row][col - 1]);
    }

    return neighbours;
  }

  getAdjacentTiles(tile) {
    const neighbours = [];
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ];

    for (const [dr, dc] of directions) {
      const row = tile.row + dr;
      const col = tile.col + dc;
      if (this.isWalkable(row, col)) {
        neighbours.push(this.grid[row][col]);
      }
    }

    return neighbours;
  }

  isInGrid(row, col) {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  quantize(position) {
    const row = Math.floor((position.z - this.minZ) / this.tileSize);
    const col = Math.floor((position.x - this.minX) / this.tileSize);
    if (!this.isInGrid(row, col)) {
      return null;
    }
    return this.grid[row][col];
  }

  localize(tile) {
    return new THREE.Vector3(
      tile.col * this.tileSize + this.minX + this.tileSize / 2,
      0,
      tile.row * this.tileSize + this.minZ + this.tileSize / 2
    );
  }

  localizeRowCol(row, col) {
    return new THREE.Vector3(
      col * this.tileSize + this.minX + this.tileSize / 2,
      0,
      row * this.tileSize + this.minZ + this.tileSize / 2
    );
  }

  getRandomWalkableTile() {
    if (this.walkableTiles.length === 0) {
      return this.findCentralWalkableTile();
    }

    const index = Math.floor(Math.random() * this.walkableTiles.length);
    return this.walkableTiles[index];
  }

  isWalkable(row, col) {
    return this.isInGrid(row, col) && this.grid[row][col].isWalkable();
  }

  isWallTile(row, col) {
    return !this.isWalkable(row, col);
  }

  collidesCircle(x, z, radius) {
    const tile = this.quantize(new THREE.Vector3(x, 0, z));
    const searchRadius = Math.ceil(radius / this.tileSize) + 1;

    if (!tile) {
      return true;
    }

    for (let dr = -searchRadius; dr <= searchRadius; dr += 1) {
      for (let dc = -searchRadius; dc <= searchRadius; dc += 1) {
        const row = tile.row + dr;
        const col = tile.col + dc;

        if (!this.isWallTile(row, col)) {
          continue;
        }

        const obstacle = this.localizeRowCol(row, col);
        const half = this.tileSize / 2;
        const nearestX = THREE.MathUtils.clamp(
          x,
          obstacle.x - half,
          obstacle.x + half
        );
        const nearestZ = THREE.MathUtils.clamp(
          z,
          obstacle.z - half,
          obstacle.z + half
        );
        const distX = x - nearestX;
        const distZ = z - nearestZ;

        if (distX * distX + distZ * distZ < radius * radius) {
          return true;
        }
      }
    }

    return false;
  }

  moveWithCollisions(position, velocity, radius, dt) {
    const next = position.clone();

    const trialX = next.x + velocity.x * dt;
    if (!this.collidesCircle(trialX, next.z, radius)) {
      next.x = trialX;
    }

    const trialZ = next.z + velocity.z * dt;
    if (!this.collidesCircle(next.x, trialZ, radius)) {
      next.z = trialZ;
    }

    return next;
  }

  getRandomOpenPoint(awayFrom, minDistance = 0) {
    for (let tries = 0; tries < 120; tries += 1) {
      const tile = this.getRandomWalkableTile();
      const point = this.localize(tile);
      if (!awayFrom || point.distanceTo(awayFrom) >= minDistance) {
        return point;
      }
    }

    return new THREE.Vector3(this.center.x, 0, this.center.z);
  }

  getEdgeSpawnPoint(awayFrom, minDistance = 12) {
    const candidates = this.walkableTiles.filter(
      (tile) =>
        tile.row <= 2 ||
        tile.col <= 2 ||
        tile.row >= this.rows - 3 ||
        tile.col >= this.cols - 3
    );

    if (candidates.length === 0) {
      return this.getRandomOpenPoint(awayFrom, minDistance);
    }

    for (let tries = 0; tries < 100; tries += 1) {
      const tile = candidates[Math.floor(Math.random() * candidates.length)];
      const point = this.localize(tile);
      if (!awayFrom || point.distanceTo(awayFrom) >= minDistance) {
        return point;
      }
    }

    return this.getRandomOpenPoint(awayFrom, minDistance);
  }

  hasLineOfSight(from, to) {
    const direction = new THREE.Vector3().subVectors(to, from);
    const distance = direction.length();
    const steps = Math.ceil(distance / (this.tileSize * 0.4));

    if (steps <= 1) {
      return true;
    }

    direction.normalize();
    for (let i = 1; i < steps; i += 1) {
      const sample = from
        .clone()
        .addScaledVector(direction, (distance / steps) * i);
      if (this.collidesCircle(sample.x, sample.z, 0.35)) {
        return false;
      }
    }

    return true;
  }

  getAvoidanceVector(position, direction, lookAhead = 3.4) {
    if (direction.lengthSq() === 0) {
      return new THREE.Vector3();
    }

    const ahead = position
      .clone()
      .addScaledVector(direction.clone().normalize(), lookAhead);
    if (!this.collidesCircle(ahead.x, ahead.z, 0.7)) {
      return new THREE.Vector3();
    }

    const offsets = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1)
    ];

    const push = new THREE.Vector3();
    for (const offset of offsets) {
      const probe = ahead.clone().addScaledVector(offset, this.tileSize);
      if (!this.collidesCircle(probe.x, probe.z, 0.4)) {
        push.add(offset);
      }
    }

    return push.normalize();
  }
}
