import { State } from "../../ai/decisions/State.js";
import { AttackObjectiveState } from "../../ai/decisions/EnemyStates/AttackObjectiveState.js";
import { GameOverState } from "./GameOverState.js";
import { IntermissionState } from "./IntermissionState.js";

export class ProtectState extends State {
  enter(world) {
    world.spawnProtect(world.currentWaveConfig);
    world.getPathfinder();
    for (let enemy of world.enemies) {
      enemy.stateMachine.change(new AttackObjectiveState());
    }
    world.hud.setMessage(`Protect Wave ${world.wave}`);
  }

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

    // Resolve projectiles and pickups
    world.resolveProjectileHits();
    world.resolvePickupCollection();
    world.cleanupObjects();

    // End game if player dies
    if (world.player.health <= 0) {
      world.gameStateMachine.change(new GameOverState());
      return;
    }

    // End game if objective is destroyed
    if (!world.protectEntity || world.protectEntity.health <= 0) {
      world.gameStateMachine.change(
        new GameOverState("Objective destroyed - press R to restart")
      );
      return;
    }

    // Go to next round if all enemies killed
    if (world.enemies.length === 0) {
      world.gameStateMachine.change(new IntermissionState());
    }
  }

  exit(world) {}
}
