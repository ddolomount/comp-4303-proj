import * as THREE from "three";
import { State } from "../State.js";
import { ChaseState } from "./ChaseState.js";
import { SteeringBehaviours } from "../../steering/SteeringBehaviours.js";
import { GroupSteeringBehaviours } from "../../steering/GroupSteeringBehaviours.js";
import { CollisionAvoidWhiskers } from "../../steering/CollisionAvoidWhiskers.js";

export class PatrolState extends State {
  enter(entity) {
    entity.wanderTarget = null;
  }

  update(entity, dt) {
    // Wander, flock with nearby enemies and avoid collisions
    let steer = new THREE.Vector3();
    steer.add(SteeringBehaviours.wander(entity));
    steer.add(
      GroupSteeringBehaviours.flock(
        entity,
        entity.world.enemies.filter((other) => other.alive),
        {
          separationRadius: 2.4,
          separationWeight: 1.2,
          alignmentRadius: 4.2,
          alignmentWeight: 0.18,
          cohesionRadius: 5.2,
          cohesionWeight: 0.08
        }
      )
    );
    steer.add(
      CollisionAvoidWhiskers.whiskers(
        entity,
        entity.world.map,
        3.4,
        2.8,
        Math.PI / 4,
        2.4,
        entity.maxForce
      ).multiplyScalar(1.1)
    );
    entity.applyForce(steer);

    // If enemy can see player begin chasing
    if (entity.canSeePlayer() || entity.alerted) {
      entity.stateMachine.change(new ChaseState());
      return;
    }

    entity.lostSightTimer = Math.max(0, entity.lostSightTimer - dt);
  }

  exit() {}
}
