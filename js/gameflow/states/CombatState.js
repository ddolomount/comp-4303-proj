import { State } from '../../ai/decisions/State.js';
import { GameOverState } from '../states/GameOverState.js'
import { IntermissionState } from '../states/IntermissionState.js'

export class CombatState extends State {
  enter(world) {}

  update(world, dt) {
    world.player.update(dt, world.input, world);

    for (let enemy of world.enemies) {
      enemy.update(dt);
    }

    for (let projectile of world.projectiles) {
      projectile.update(dt);
    }

    for (let pickup of world.pickups) {
      pickup.update(dt);
    }

    world.resolveProjectileHits();
    world.resolvePickupCollection();
    world.cleanupObjects();

    if (world.player.health <= 0) {
      world.gameStateMachine.change(new GameOverState());
    }

    if (world.enemies.length === 0) {
      world.gameStateMachine.change(new IntermissionState());
    }
  }
 
  exit(world) {}
}
