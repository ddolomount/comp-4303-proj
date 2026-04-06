import * as THREE from 'three';
import { SteeringBehaviours } from './SteeringBehaviours.js';

export class CollisionAvoidWhiskers {
  static whiskers(
    entity,
    map,
    lookAhead = 3.2,
    howFar = 2.4,
    whiskerAngle = Math.PI / 4,
    whiskerLength = 2.2,
    maxForce = entity.maxForce ?? 15,
    debug = null
  ) {
    const steer = new THREE.Vector3();
    const forward = this.getForward(entity);
    if (forward.lengthSq() === 0) {
      return steer;
    }

    const start = entity.position.clone();
    const leftDir = forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), whiskerAngle);
    const rightDir = forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -whiskerAngle);

    const rays = [
      { name: 'center', dir: forward, len: lookAhead, weight: 1.2 },
      { name: 'left', dir: leftDir, len: whiskerLength, weight: 0.85 },
      { name: 'right', dir: rightDir, len: whiskerLength, weight: 0.85 },
    ];

    for (const ray of rays) {
      let end = start.clone().addScaledVector(ray.dir, ray.len);

      let hit = this.closestWallHit(start, end, map, entity.radius ?? 0.4);

      let target = hit.collisionPoint.clone().addScaledVector(hit.normal, howFar);
      let force = SteeringBehaviours.seek(entity, target).multiplyScalar(ray.weight);
      steer.add(force);
    }

    steer.clampLength(0, maxForce);
    return steer;
  }

  static getForward(entity) {
    const forward = entity.velocity.clone();
    forward.y = 0;

    if (forward.lengthSq() < 0.0001 && entity.forward) {
      forward.copy(entity.forward);
      forward.y = 0;
    }

    if (forward.lengthSq() < 0.0001) {
      return new THREE.Vector3();
    }

    return forward.normalize();
  }

  static closestWallHit(start, end, map, radius = 0.4) {
    const direction = end.clone().sub(start);
    const distance = direction.length();
    if (distance === 0) {
      return null;
    }

    const steps = Math.max(4, Math.ceil(distance / Math.max(0.2, map.tileSize * 0.2)));
    direction.normalize();

    for (let i = 1; i <= steps; i += 1) {
      const sample = start.clone().addScaledVector(direction, (distance / steps) * i);
      if (!map.collidesCircle(sample.x, sample.z, radius)) {
        continue;
      }

      const wallData = this.getNearestWallData(map, sample, radius);
      if (wallData) {
        return wallData;
      }
    }

    return null;
  }

  static getNearestWallData(map, point, radius) {
    const row = Math.floor((point.z - map.minZ) / map.tileSize);
    const col = Math.floor((point.x - map.minX) / map.tileSize);
    const searchRadius = Math.ceil(radius / map.tileSize) + 2;
    let best = null;
    let bestDistanceSq = Infinity;

    for (let dr = -searchRadius; dr <= searchRadius; dr += 1) {
      for (let dc = -searchRadius; dc <= searchRadius; dc += 1) {
        const testRow = row + dr;
        const testCol = col + dc;
        if (!map.isWallTile(testRow, testCol)) {
          continue;
        }

        const wallCenter = map.localizeRowCol(testRow, testCol);
        const half = map.tileSize / 2;
        const nearestPoint = new THREE.Vector3(
          THREE.MathUtils.clamp(point.x, wallCenter.x - half, wallCenter.x + half),
          0,
          THREE.MathUtils.clamp(point.z, wallCenter.z - half, wallCenter.z + half)
        );

        const distanceSq = nearestPoint.distanceToSquared(point);
        if (distanceSq > radius * radius || distanceSq >= bestDistanceSq) {
          continue;
        }

        let normal = point.clone().sub(nearestPoint);
        if (normal.lengthSq() < 0.0001) {
          normal = point.clone().sub(wallCenter);
        }
        if (normal.lengthSq() < 0.0001) {
          normal = new THREE.Vector3(1, 0, 0);
        }

        normal.normalize();
        best = {
          collisionPoint: nearestPoint,
          normal,
          wallCenter,
        };
        bestDistanceSq = distanceSq;
      }
    }

    return best;
  }

}
