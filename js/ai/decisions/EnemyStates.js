import { State } from './State.js';

export class PatrolState extends State {
  enter(enemy) {
    enemy.wanderTarget = null;
  }

  update(enemy, dt) {
    enemy.wander();

    if (enemy.canSeePlayer() || enemy.alerted) {
      enemy.stateMachine.change(new ChaseState());
      return;
    }

    enemy.lostSightTimer = Math.max(0, enemy.lostSightTimer - dt);
  }

  exit() {}
}

export class ChaseState extends State {
  enter(enemy) {
    enemy.alerted = true;
    enemy.lostSightTimer = 0;
  }

  update(enemy, dt) {
    if (enemy.canSeePlayer()) {
      enemy.lostSightTimer = 0;
    } else {
      enemy.lostSightTimer += dt;
      if (enemy.lostSightTimer > 4.5) {
        enemy.alerted = false;
        enemy.stateMachine.change(new PatrolState());
        return;
      }
    }

    enemy.pursuePlayer();

    const distance = enemy.position.distanceTo(enemy.world.player.position);
    if (distance <= enemy.attackRange + 0.8) {
      enemy.stateMachine.change(new AttackState());
    }
  }

  exit() {}
}

export class AttackState extends State {
  enter() {}

  update(enemy) {
    const player = enemy.world.player;
    const distance = enemy.position.distanceTo(player.position);

    if (enemy.variant === 'melee') {
      enemy.pursuePlayer(1.1);
      if (distance > enemy.attackRange + 1.4) {
        enemy.stateMachine.change(new ChaseState());
      }
      return;
    }

    const desired = player.position.clone().sub(enemy.position).setY(0);
    if (desired.lengthSq() > 0.0001) {
      desired.normalize();
    }

    if (distance < enemy.attackRange * 0.65) {
      desired.multiplyScalar(-0.5);
    }
    enemy.desiredVelocity.copy(desired);

    if (!enemy.world.arena.hasLineOfSight(enemy.position, player.position) || distance > enemy.attackRange + 3) {
      enemy.stateMachine.change(new ChaseState());
      return;
    }

    enemy.fireAtPlayer();
  }

  exit() {}
}
