import { State } from "../../ai/decisions/State.js";
import { GameOverState } from "../states/GameOverState.js";
import { IntermissionState } from "../states/IntermissionState.js";

export class CombatState extends State {
  enter(world) {}

  update(world, dt) {
    // Update player
    world.player.update(dt, world.input, world);

    // Update enemies
    for (let enemy of world.enemies) {
      enemy.update(dt);
    }

    // Update projectiles
    for (let projectile of world.projectiles) {
      projectile.update(dt);
    }

    // Update pickups
    for (let pickup of world.pickups) {
      pickup.update(dt);
    }

    // Resolve any projectiles and pickups
    world.resolveProjectileHits();
    world.resolvePickupCollection();
    world.cleanupObjects();

    // End game if player dies
    if (world.player.health <= 0) {
      world.gameStateMachine.change(new GameOverState());
    }

    // Go to intermission if all enemies killed
    if (world.enemies.length === 0) {
      world.gameStateMachine.change(new IntermissionState());
    }
  }

  exit(world) {}
}
