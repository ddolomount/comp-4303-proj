import * as THREE from 'three';

const FLOOR_Y = -0.5;

export class Arena {
  constructor(scene) {
    this.scene = scene;
    this.width = 31;
    this.height = 31;
    this.cellSize = 3;
    this.center = new THREE.Vector3();
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.generate();
  }

  generate() {
    if (this.group) {
      this.scene.remove(this.group);
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

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.grid = this.createGrid();
    this.openCells = this.collectOpenCells();

    const widthWorld = this.width * this.cellSize;
    const heightWorld = this.height * this.cellSize;

    this.center.set(0, 0, 0);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(widthWorld, 1, heightWorld),
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
    this.group.add(floor);

    const lineMaterial = new THREE.LineBasicMaterial({ color: '#1fffc3', transparent: true, opacity: 0.22 });
    for (let x = 0; x <= this.width; x += 1) {
      const gx = -widthWorld / 2 + x * this.cellSize;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(gx, 0.02, -heightWorld / 2),
        new THREE.Vector3(gx, 0.02, heightWorld / 2),
      ]);
      this.group.add(new THREE.Line(geometry, lineMaterial));
    }

    for (let z = 0; z <= this.height; z += 1) {
      const gz = -heightWorld / 2 + z * this.cellSize;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-widthWorld / 2, 0.02, gz),
        new THREE.Vector3(widthWorld / 2, 0.02, gz),
      ]);
      this.group.add(new THREE.Line(geometry, lineMaterial));
    }

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: '#12312a',
      emissive: '#1fffc3',
      emissiveIntensity: 0.2,
      metalness: 0.2,
      roughness: 0.5,
    });
    const wallGeometry = new THREE.BoxGeometry(this.cellSize, 3.4, this.cellSize);

    for (let z = 0; z < this.height; z += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (!this.grid[z][x]) {
          continue;
        }

        const mesh = new THREE.Mesh(wallGeometry, wallMaterial);
        const world = this.cellToWorld(x, z);
        mesh.position.set(world.x, 1.2, world.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);
      }
    }
  }

  createGrid() {
    let grid = Array.from({ length: this.height }, (_, z) => (
      Array.from({ length: this.width }, (_, x) => {
        if (x === 0 || z === 0 || x === this.width - 1 || z === this.height - 1) {
          return 1;
        }

        const centerX = Math.floor(this.width / 2);
        const centerZ = Math.floor(this.height / 2);
        if (Math.abs(x - centerX) <= 2 && Math.abs(z - centerZ) <= 2) {
          return 0;
        }

        return Math.random() < 0.41 ? 1 : 0;
      })
    ));

    for (let i = 0; i < 5; i += 1) {
      grid = this.smoothGrid(grid);
    }

    grid = this.keepLargestRegion(grid);
    grid = this.carveExtraRoutes(grid, 7);
    return grid;
  }

  smoothGrid(grid) {
    return grid.map((row, z) => row.map((cell, x) => {
      const walls = this.countNeighbors(grid, x, z);
      if (walls > 4) {
        return 1;
      }

      if (walls < 4) {
        return 0;
      }

      return cell;
    }));
  }

  countNeighbors(grid, x, z) {
    let count = 0;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dz === 0) {
          continue;
        }

        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= this.width || nz >= this.height || grid[nz][nx]) {
          count += 1;
        }
      }
    }
    return count;
  }

  keepLargestRegion(grid) {
    const visited = new Set();
    let bestRegion = [];

    for (let z = 1; z < this.height - 1; z += 1) {
      for (let x = 1; x < this.width - 1; x += 1) {
        const key = `${x},${z}`;
        if (grid[z][x] || visited.has(key)) {
          continue;
        }

        const region = [];
        const queue = [[x, z]];
        visited.add(key);

        while (queue.length > 0) {
          const [cx, cz] = queue.shift();
          region.push([cx, cz]);

          const neighbors = [
            [cx + 1, cz],
            [cx - 1, cz],
            [cx, cz + 1],
            [cx, cz - 1],
          ];

          for (const [nx, nz] of neighbors) {
            if (nx <= 0 || nz <= 0 || nx >= this.width - 1 || nz >= this.height - 1) {
              continue;
            }

            const neighborKey = `${nx},${nz}`;
            if (grid[nz][nx] || visited.has(neighborKey)) {
              continue;
            }

            visited.add(neighborKey);
            queue.push([nx, nz]);
          }
        }

        if (region.length > bestRegion.length) {
          bestRegion = region;
        }
      }
    }

    const bestCells = new Set(bestRegion.map(([x, z]) => `${x},${z}`));
    return grid.map((row, z) => row.map((cell, x) => {
      if (cell) {
        return 1;
      }

      return bestCells.has(`${x},${z}`) ? 0 : 1;
    }));
  }

  carveExtraRoutes(grid, tunnelCount) {
    const next = grid.map((row) => [...row]);
    const centerX = Math.floor(this.width / 2);
    const centerZ = Math.floor(this.height / 2);

    for (let i = 0; i < tunnelCount; i += 1) {
      let x = centerX;
      let z = centerZ;
      const steps = 6 + Math.floor(Math.random() * 12);
      const dir = Math.random() < 0.5 ? [1, 0] : [0, 1];
      const sign = Math.random() < 0.5 ? -1 : 1;
      const dx = dir[0] * sign;
      const dz = dir[1] * sign;

      for (let step = 0; step < steps; step += 1) {
        x = THREE.MathUtils.clamp(x + dx, 1, this.width - 2);
        z = THREE.MathUtils.clamp(z + dz, 1, this.height - 2);
        next[z][x] = 0;
      }
    }

    return next;
  }

  collectOpenCells() {
    const cells = [];
    for (let z = 0; z < this.height; z += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (!this.grid[z][x]) {
          cells.push({ x, z });
        }
      }
    }
    return cells;
  }

  cellToWorld(x, z) {
    return {
      x: (x - this.width / 2 + 0.5) * this.cellSize,
      z: (z - this.height / 2 + 0.5) * this.cellSize,
    };
  }

  worldToCell(x, z) {
    return {
      x: Math.floor((x / this.cellSize) + this.width / 2),
      z: Math.floor((z / this.cellSize) + this.height / 2),
    };
  }

  isWallCell(x, z) {
    if (x < 0 || z < 0 || x >= this.width || z >= this.height) {
      return true;
    }

    return this.grid[z][x] === 1;
  }

  collidesCircle(x, z, radius) {
    const cell = this.worldToCell(x, z);
    const searchRadius = Math.ceil(radius / this.cellSize) + 1;

    for (let dz = -searchRadius; dz <= searchRadius; dz += 1) {
      for (let dx = -searchRadius; dx <= searchRadius; dx += 1) {
        const cx = cell.x + dx;
        const cz = cell.z + dz;

        if (!this.isWallCell(cx, cz)) {
          continue;
        }

        const wall = this.cellToWorld(cx, cz);
        const half = this.cellSize / 2;
        const nearestX = THREE.MathUtils.clamp(x, wall.x - half, wall.x + half);
        const nearestZ = THREE.MathUtils.clamp(z, wall.z - half, wall.z + half);
        const distX = x - nearestX;
        const distZ = z - nearestZ;
        if ((distX * distX) + (distZ * distZ) < radius * radius) {
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
      const cell = this.openCells[Math.floor(Math.random() * this.openCells.length)];
      const world = this.cellToWorld(cell.x, cell.z);
      const point = new THREE.Vector3(world.x, 0, world.z);
      if (!awayFrom || point.distanceTo(awayFrom) >= minDistance) {
        return point;
      }
    }

    return new THREE.Vector3(this.center.x, 0, this.center.z);
  }

  getEdgeSpawnPoint(awayFrom, minDistance = 12) {
    const candidates = this.openCells.filter(({ x, z }) => (
      x <= 2 || z <= 2 || x >= this.width - 3 || z >= this.height - 3
    ));

    for (let tries = 0; tries < 100; tries += 1) {
      const cell = candidates[Math.floor(Math.random() * candidates.length)];
      const world = this.cellToWorld(cell.x, cell.z);
      const point = new THREE.Vector3(world.x, 0, world.z);
      if (!awayFrom || point.distanceTo(awayFrom) >= minDistance) {
        return point;
      }
    }

    return this.getRandomOpenPoint(awayFrom, minDistance);
  }

  hasLineOfSight(from, to) {
    const direction = new THREE.Vector3().subVectors(to, from);
    const distance = direction.length();
    const steps = Math.ceil(distance / (this.cellSize * 0.4));
    if (steps <= 1) {
      return true;
    }

    direction.normalize();
    for (let i = 1; i < steps; i += 1) {
      const sample = from.clone().addScaledVector(direction, (distance / steps) * i);
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

    const ahead = position.clone().addScaledVector(direction.clone().normalize(), lookAhead);
    if (!this.collidesCircle(ahead.x, ahead.z, 0.7)) {
      return new THREE.Vector3();
    }

    const offsets = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
    ];

    const push = new THREE.Vector3();
    for (const offset of offsets) {
      const probe = ahead.clone().addScaledVector(offset, this.cellSize);
      if (!this.collidesCircle(probe.x, probe.z, 0.4)) {
        push.add(offset);
      }
    }

    return push.normalize();
  }
}
