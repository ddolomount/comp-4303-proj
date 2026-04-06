import { State } from '../../ai/decisions/State.js';
import { GameOverState } from './GameOverState.js';
import { IntermissionState } from './IntermissionState.js';

export class ProtectState extends State {
  enter(world) {
    world.protectTimer = 0;
    world.spawnProtect(world.currentWaveConfig);
    world.hud.setMessage(`Protect Wave ${world.wave}`);
  }

  update(world, dt) {
    world.protectTimer += dt;

    world.player.update(dt, world.input, world);

    for (const enemy of world.enemies) {
      enemy.update(dt);
    }

    for (const projectile of world.projectiles) {
      projectile.update(dt);
    }

    for (const pickup of world.pickups) {
      pickup.update(dt);
    }

    world.resolveProjectileHits();
    world.resolvePickupCollection();
    world.cleanupObjects();

    if (world.player.health <= 0) {
      world.gameStateMachine.change(new GameOverState());
      return;
    }

    if (world.enemies.length === 0) {
      world.gameStateMachine.change(new IntermissionState());
    }
  }

  exit(world) {}
}
