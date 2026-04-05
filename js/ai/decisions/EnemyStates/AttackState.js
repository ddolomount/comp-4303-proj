import { State } from '../State.js';
import { ChaseState } from './ChaseState.js';
import { SteeringBehaviours } from '../../steering/SteeringBehaviours.js';

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
      entity.applyForce(arriveForce.multiplyScalar(1.35));

      return;
    }

    if (!entity.world.map.hasLineOfSight(entity.position, player.position) || distance > entity.attackRange + 3) {
      entity.stateMachine.change(new ChaseState());
      return;
    }

    if (distance < entity.attackRange * 0.65) {
      entity.applyForce(SteeringBehaviours.evade(entity, player, 0.2));
    } else if (distance > entity.attackRange * 0.95) {
      entity.applyForce(SteeringBehaviours.pursue(entity, player, 0.3));
    }

    entity.fireAtPlayer();
  }

  exit() {}
}
