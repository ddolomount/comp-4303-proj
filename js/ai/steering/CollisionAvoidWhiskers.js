import * as THREE from "three";
import { SteeringBehaviours } from "./SteeringBehaviours.js";

export class CollisionAvoidWhiskers {
  static whiskers(
    entity,
    map,
    lookAhead,
    howFar,
    whiskerAngle,
    whiskerLength,
    maxForce,
    debug = null
  ) {
    let steer = new THREE.Vector3();
    let forward = this.getForward(entity);
    if (forward.lengthSq() === 0) {
      return steer;
    }

    let start = entity.position.clone();

    let cosA = Math.cos(whiskerAngle);
    let sinA = Math.sin(whiskerAngle);

    let leftDir = new THREE.Vector3(
      forward.x * cosA - forward.z * sinA,
      0,
      forward.x * sinA + forward.z * cosA
    );

    let rightDir = new THREE.Vector3(
      forward.x * cosA + forward.z * sinA,
      0,
      -forward.x * sinA + forward.z * cosA
    );

    let speedScale = this.getSpeedScale(entity);
    let scaledLookAhead = lookAhead * speedScale;
    let scaledWhiskerLength = whiskerLength * speedScale;

    let rays = [
      { name: "center", dir: forward, len: scaledLookAhead, weight: 1.2 },
      { name: "left", dir: leftDir, len: scaledWhiskerLength, weight: 0.85 },
      { name: "right", dir: rightDir, len: scaledWhiskerLength, weight: 0.85 }
    ];

    // Choose force for each ray based on closest obstacle
    for (const ray of rays) {
      let end = start.clone().addScaledVector(ray.dir, ray.len);

      let hit = this.closestWallHit(start, end, map, entity.radius);

      if (hit) {
        let target = hit.collisionPoint
          .clone()
          .addScaledVector(hit.normal, howFar);
        let force = SteeringBehaviours.seek(entity, target).multiplyScalar(
          ray.weight
        );

        steer.add(force);
      }
    }

    steer.clampLength(0, maxForce);
    return steer;
  }

  static getSpeedScale(entity) {
    let speed = entity.velocity?.length?.() ?? 0;
    let topSpeed = entity.topSpeed;

    let speedRatio = THREE.MathUtils.clamp(speed / topSpeed, 0, 1);
    return THREE.MathUtils.lerp(0.2, 1, speedRatio);
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

  // Check if / where ray enters wall
  static closestWallHit(start, end, map, radius = 0.4) {
    let direction = end.clone().sub(start);
    let distance = direction.length();
    if (distance === 0) {
      return null;
    }

    // Create steps to break ray into smaller pieces to check
    let steps = Math.max(
      4,
      Math.ceil(distance / Math.max(0.2, map.tileSize * 0.2))
    );
    direction.normalize();

    // Iterate over ray in steps
    for (let i = 1; i <= steps; i += 1) {
      const sample = start
        .clone()
        .addScaledVector(direction, (distance / steps) * i);

      // Check if overlapping with wall
      if (!map.collidesCircle(sample.x, sample.z, radius)) {
        continue;
      }

      let wallData = this.getNearestWallData(map, sample, radius);
      if (wallData) {
        return wallData;
      }
    }

    return null;
  }

  // Get data about nearest wall to entity
  static getNearestWallData(map, point, radius) {
    const tile = map.quantize(point);
    if (!tile) {
      return null;
    }

    let searchRadius = Math.ceil(radius / map.tileSize) + 2;
    let best = null;
    let bestDistanceSq = Infinity;

    // Check all nearby tiles around the current tile
    for (
      let deltaRow = -searchRadius;
      deltaRow <= searchRadius;
      deltaRow += 1
    ) {
      for (
        let deltaCol = -searchRadius;
        deltaCol <= searchRadius;
        deltaCol += 1
      ) {
        let testRow = tile.row + deltaRow;
        let testCol = tile.col + deltaCol;

        // Ignore floor tiles
        if (!map.isWallTile(testRow, testCol)) {
          continue;
        }

        // Get wall tile bounds and find closest point on wall
        let wallCenter = map.localizeRowCol(testRow, testCol);
        let half = map.tileSize / 2;
        let nearestPoint = new THREE.Vector3(
          THREE.MathUtils.clamp(
            point.x,
            wallCenter.x - half,
            wallCenter.x + half
          ),
          0,
          THREE.MathUtils.clamp(
            point.z,
            wallCenter.z - half,
            wallCenter.z + half
          )
        );

        // Check if point on wall is farther than collision radius
        let distanceSq = nearestPoint.distanceToSquared(point);
        if (distanceSq > radius * radius || distanceSq >= bestDistanceSq) {
          continue;
        }

        // Create normal vector to wall
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
          wallCenter
        };
        bestDistanceSq = distanceSq;
      }
    }

    return best;
  }
}
