import { State } from '../State.js';
import { ChaseState } from './ChaseState.js';
import { SteeringBehaviours } from '../../steering/SteeringBehaviours.js';

export class PatrolState extends State {
  
  enter(entity) {
    entity.wanderTarget = null;
  }

  update(entity, dt) {
    const wanderForce = SteeringBehaviours.wander(entity);
    entity.applyForce(wanderForce);
    
    if (entity.canSeePlayer() || entity.alerted) {
      entity.stateMachine.change(new ChaseState());
      return;
    }

    entity.lostSightTimer = Math.max(0, entity.lostSightTimer - dt);
  }

  exit() {}
}
