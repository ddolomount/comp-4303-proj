import * as THREE from "three";
import { State } from "../State.js";
import { AttackPlayerState } from "./AttackPlayerState.js";
import { PatrolState } from "./PatrolState.js";
import { SteeringBehaviours } from "../../steering/SteeringBehaviours.js";
import { GroupSteeringBehaviours } from "../../steering/GroupSteeringBehaviours.js";
import { CollisionAvoidWhiskers } from "../../steering/CollisionAvoidWhiskers.js";

export class ChaseState extends State {
  enter(entity) {
    entity.alerted = true;
    entity.lostSightTimer = 0;
  }

  update(entity, dt) {
    let distance = entity.position.distanceTo(entity.world.player.position);

    // Handle lost sight time based on if enemy can see player
    if (entity.canSeePlayer()) {
      entity.lostSightTimer = 0;
    } else {
      entity.lostSightTimer += dt;
      // Go to patrol state if enemy hasn't seen player for 4.5s
      if (entity.lostSightTimer > 4.5) {
        entity.alerted = false;
        entity.stateMachine.change(new PatrolState());
        return;
      }
    }

    // Ranged enemies lead player more than melee
    let lookAhead = entity.variant === "melee" ? 0.12 : 0.4;
    
    // Check if player is close enough for melee enemy to being pressuring
    let isMeleePressuring =
      entity.variant === "melee" && distance <= entity.meleeEngageRange;
    
    // Pursue player, flock with nearby enemies and avoid collisions
    let steer = new THREE.Vector3();
    steer.add(
      SteeringBehaviours.pursue(entity, entity.world.player, lookAhead)
    );
    
    // Reduce flocking if melee close enough to pressure
    steer.add(
      GroupSteeringBehaviours.flock(
        entity,
        entity.world.enemies.filter((other) => other.alive),
        {
          separationRadius: 2.2,
          separationWeight: isMeleePressuring ? 0.4 : 1.05,
          alignmentRadius: 3.6,
          alignmentWeight: isMeleePressuring ? 0.04 : 0.12,
          cohesionRadius: 4.6,
          cohesionWeight: isMeleePressuring ? 0 : 0.04
        }
      )
    );

    // Reduce collision avoidance if close enough to pressure
    steer.add(
      CollisionAvoidWhiskers.whiskers(
        entity,
        entity.world.map,
        isMeleePressuring ? 1.8 : 3.1,
        isMeleePressuring ? 1.5 : 2.4,
        Math.PI / 4,
        isMeleePressuring ? 1.6 : 2.2,
        entity.maxForce
      ).multiplyScalar(isMeleePressuring ? 0.45 : 1)
    );
    entity.applyForce(steer);

    // Enter attack state if close enough range to player
    let enterAttackRange =
      entity.variant === "melee"
        ? entity.attackRange + entity.world.player.radius + 0.35
        : entity.attackRange + 0.8;
    if (distance <= enterAttackRange) {
      entity.stateMachine.change(new AttackPlayerState());
    }
  }

  exit() {}
}
