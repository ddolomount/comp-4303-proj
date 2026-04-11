import { State } from "../../ai/decisions/State.js";
import { CombatState } from "./CombatState.js";
import { ProtectState } from "./ProtectState.js";

export class WaveSetupState extends State {
  enter(world) {
    world.wave += 1;
    world.pendingWaveTimer = 0;
    world.arenaRegenerated = false;
    world.currentWaveConfig = world.waveDirector.getWaveConfig(world.wave);

    world.clearTransientObjects();

    if (world.map) {
      world.map.generate();
    }

    if (world.player && world.map) {
      world.player.setPosition(world.map.center.x, world.map.center.z);
      if (typeof world.player.syncVisuals === "function") {
        world.player.syncVisuals();
      }
    }

    world.spawnEnemies(world.currentWaveConfig);

    world.spawnWavePickups();

    if (world.hud) {
      const label =
        world.currentWaveConfig.type === "protect"
          ? `Protect Wave ${world.wave}`
          : `Wave ${world.wave}`;
      world.hud.setMessage(label);
    }

    if (world.gameStateMachine) {
      if (world.currentWaveConfig.type === "protect") {
        world.gameStateMachine.change(new ProtectState());
      } else {
        world.gameStateMachine.change(new CombatState());
      }
    }
  }

  update(world, dt) {}

  exit(world) {}
}
