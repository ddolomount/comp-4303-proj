import { State } from '../State.js';
import { AttackState } from './AttackState.js';
import { PatrolState } from './PatrolState.js';
import { SteeringBehaviours } from '../../steering/SteeringBehaviours.js';

export class ChaseState extends State {
  enter(entity) {
    entity.alerted = true;
    entity.lostSightTimer = 0;
  }

  update(entity, dt) {
    if (entity.canSeePlayer()) {
      entity.lostSightTimer = 0;
    } else {
      entity.lostSightTimer += dt;
      if (entity.lostSightTimer > 4.5) {
        entity.alerted = false;
        entity.stateMachine.change(new PatrolState());
        return;
      }
    }

    const lookAhead = entity.variant === 'melee' ? 0.12 : 0.4;
    const pursueForce = SteeringBehaviours.pursue(entity, entity.world.player, lookAhead);
    entity.applyForce(pursueForce);

    const distance = entity.position.distanceTo(entity.world.player.position);
    const enterAttackRange = entity.variant === 'melee'
      ? entity.attackRange + entity.world.player.radius + 0.35
      : entity.attackRange + 0.8;
    if (distance <= enterAttackRange) {
      entity.stateMachine.change(new AttackState());
    }
  }

  exit() {}
}
