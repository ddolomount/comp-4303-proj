import * as THREE from 'three';
import { State } from '../State.js';
import { ChaseState } from './ChaseState.js';
import { SteeringBehaviours } from '../../steering/SteeringBehaviours.js';
import { GroupSteeringBehaviours } from '../../steering/GroupSteeringBehaviours.js';
import { CollisionAvoidWhiskers } from '../../steering/CollisionAvoidWhiskers.js';

export class AttackState extends State {
  enter() {}

  update(entity, dt) {
    const player = entity.world.player;
    const distance = entity.position.distanceTo(player.position);

    if (entity.variant === 'melee') {
      const contactRange = entity.attackRange + player.radius;

      if (distance > contactRange + 1.2) {
        entity.stateMachine.change(new ChaseState());
        return;
      }

      if (distance <= contactRange + 0.1) {
        entity.velocity.multiplyScalar(0.35);
        entity.touchPlayer();
        return;
      }

      const arriveForce = SteeringBehaviours.arrive(
        entity,
        player,
        contactRange + 0.55,
        Math.max(0.15, contactRange - 0.1)
      );
      let steer = new THREE.Vector3();
      steer.add(arriveForce.multiplyScalar(1.35));
      steer.add(GroupSteeringBehaviours.flock(entity, entity.world.enemies.filter((other) => other.alive), {
        separationRadius: 2,
        separationWeight: 0.22,
        alignmentRadius: 3,
        alignmentWeight: 0,
        cohesionRadius: 3.5,
        cohesionWeight: 0,
      }));
      steer.add(
        CollisionAvoidWhiskers.whiskers(entity, entity.world.map, 1.4, 1.2, Math.PI / 4, 1.3, entity.maxForce)
          .multiplyScalar(0.25)
      );
      entity.applyForce(steer);

      return;
    }

    if (!entity.world.map.hasLineOfSight(entity.position, player.position) || distance > entity.attackRange + 3) {
      entity.stateMachine.change(new ChaseState());
      return;
    }

    let steer = new THREE.Vector3();
    if (distance < entity.attackRange * 0.65) {
      steer.add(SteeringBehaviours.evade(entity, player, 0.2));
    } else if (distance > entity.attackRange * 0.95) {
      steer.add(SteeringBehaviours.pursue(entity, player, 0.3));
    }
    steer.add(GroupSteeringBehaviours.flock(entity, entity.world.enemies.filter((other) => other.alive), {
      separationRadius: 2.4,
      separationWeight: 0.9,
      alignmentRadius: 3.8,
      alignmentWeight: 0.08,
      cohesionRadius: 4.2,
      cohesionWeight: 0,
    }));
    steer.add(
      CollisionAvoidWhiskers.whiskers(entity, entity.world.map, 2.4, 2, Math.PI / 4, 1.8, entity.maxForce)
        .multiplyScalar(0.8)
    );
    entity.applyForce(steer);

    entity.fireAtPlayer();
  }

  exit() {}
}
