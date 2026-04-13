import * as THREE from "three";
import { State } from "../State.js";
import { PatrolState } from "./PatrolState.js";
import { SteeringBehaviours } from "../../steering/SteeringBehaviours.js";
import { GroupSteeringBehaviours } from "../../steering/GroupSteeringBehaviours.js";
import { CollisionAvoidWhiskers } from "../../steering/CollisionAvoidWhiskers.js";

let WAYPOINT_REACHED_DISTANCE = 0.8;

export class AttackObjectiveState extends State {
  enter(entity) {
    entity.alerted = false;
    entity.lostSightTimer = 0;
    entity.protectPath = [];
    entity.protectPathIndex = 0;
    entity.protectPathGoalKey = null;
    entity.protectRepathTimer = 0;
    this.rebuildPath(entity);
  }

  update(entity, dt) {
    let protectEntity = entity.world.protectEntity;
    if (!protectEntity) {
      entity.stateMachine.change(new PatrolState());
      return;
    }

    // Timer for rebuilding path
    entity.protectRepathTimer = Math.max(
      0,
      (entity.protectRepathTimer ?? 0) - dt
    );

    let distanceToObjective = entity.position.distanceTo(
      protectEntity.position
    );
    let contactRange = protectEntity.radius + entity.radius + 0.35;

    // Check if ranged enemy has line of sight and within range
    let rangedCanAttack =
      entity.variant === "ranged" &&
      distanceToObjective <= entity.attackRange &&
      entity.world.map.hasLineOfSight(entity.position, protectEntity.position);

    // Attack objective and slow down if range enemy is able
    if (rangedCanAttack) {
      entity.velocity.multiplyScalar(0.65);
      entity.fireAtProtectObjective();
      return;
    }

    // Attack objective and slow down if melee enemy is able
    if (entity.variant !== "ranged" && distanceToObjective <= contactRange) {
      entity.velocity.multiplyScalar(0.35);
      entity.touchProtectObjective();
      return;
    }

    // Rebuild path if timer expires or path does not exist
    let goalTile = entity.world.map.quantize(protectEntity.position);
    let goalKey = goalTile ? `${goalTile.row}:${goalTile.col}` : null; // TODO: Check this
    if (
      entity.protectRepathTimer === 0 ||
      !entity.protectPath?.length ||
      entity.protectPathGoalKey !== goalKey
    ) {
      this.rebuildPath(entity);
    }

    // Determine how close enemy needs to get to objective
    let waypoint = this.getCurrentWaypoint(entity);
    let finalStandOff =
      entity.variant === "ranged" && distanceToObjective > entity.attackRange
        ? Math.max(contactRange, entity.attackRange * 0.85)
        : contactRange + 0.4;
    let isAtObjective = distanceToObjective <= finalStandOff;
    let steer = new THREE.Vector3();

    // Arrive at objective if no more waypoints
    if (!waypoint || isAtObjective) {
      steer.add(
        SteeringBehaviours.arrive(
          entity,
          protectEntity,
          finalStandOff + 2.4,
          finalStandOff
        ).multiplyScalar(1.25)
      );
    } else {
      // Follow path waypoint-by-waypoint
      let isFinalWaypoint =
        entity.protectPathIndex >= entity.protectPath.length - 1;
      let targetPoint = isFinalWaypoint ? protectEntity.position : waypoint;
      let targetRadius = isFinalWaypoint ? finalStandOff + 1.8 : 1.35;
      let stopRadius = isFinalWaypoint ? finalStandOff : 0.2;
      steer.add(
        SteeringBehaviours.arrive(
          entity,
          targetPoint,
          targetRadius,
          stopRadius
        ).multiplyScalar(1.2)
      );
    }

    // Flock with other enemys and avoid collisions
    steer.add(
      GroupSteeringBehaviours.flock(
        entity,
        entity.world.enemies.filter((other) => other.alive),
        {
          separationRadius: 2.3,
          separationWeight: 1.1,
          alignmentRadius: 3.8,
          alignmentWeight: 0.08,
          cohesionRadius: 4.5,
          cohesionWeight: 0.03
        }
      )
    );
    steer.add(
      CollisionAvoidWhiskers.whiskers(
        entity,
        entity.world.map,
        2.8,
        2.2,
        Math.PI / 4,
        2,
        entity.maxForce
      ).multiplyScalar(0.95)
    );
    entity.applyForce(steer);
  }

  exit(entity) {
    entity.protectPath = [];
    entity.protectPathIndex = 0;
    entity.protectPathGoalKey = null;
    entity.protectRepathTimer = 0;
  }

  // Check reached waypoints and return next waypoint
  getCurrentWaypoint(entity) {
    while (entity.protectPathIndex < entity.protectPath.length) {
      let waypoint = entity.protectPath[entity.protectPathIndex];
      if (entity.position.distanceTo(waypoint) <= WAYPOINT_REACHED_DISTANCE) {
        entity.protectPathIndex += 1;
        continue;
      }

      return waypoint;
    }

    return null;
  }

  // Compute new path to objective
  rebuildPath(entity) {
    let protectEntity = entity.world.protectEntity;
    let pathfinder = entity.world.getPathfinder();
    if (!protectEntity || !pathfinder) {
      entity.protectPath = [];
      entity.protectPathIndex = 0;
      entity.protectPathGoalKey = null;
      entity.protectRepathTimer = 0.4;
      return;
    }

    // Quantize start and goal tiles
    let startTile = entity.world.map.quantize(entity.position);
    let goalTile = entity.world.map.quantize(protectEntity.position);
    if (!startTile || !goalTile) {
      entity.protectPath = [];
      entity.protectPathIndex = 0;
      entity.protectPathGoalKey = null;
      entity.protectRepathTimer = 0.4;
      return;
    }

    // Find path and convert to world space
    let path = pathfinder.findPath(startTile, goalTile);
    entity.protectPath = path
      .slice(1)
      .map((tile) => entity.world.map.localize(tile));
    entity.protectPathIndex = 0;
    entity.protectPathGoalKey = `${goalTile.row}:${goalTile.col}`;
    entity.protectRepathTimer = 0.45;
  }
}
