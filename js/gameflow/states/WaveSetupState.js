import { State } from "../../ai/decisions/State.js";
import { CombatState } from "./CombatState.js";
import { ProtectState } from "./ProtectState.js";

export class WaveSetupState extends State {
  enter(world) {
    // Increment wave count
    world.wave += 1;

    world.pendingWaveTimer = 0;
    world.arenaRegenerated = false;

    // Get new wave config based on current wave
    world.currentWaveConfig = world.waveDirector.getWaveConfig(world.wave);

    world.clearTransientObjects();

    // Generate a new arena
    if (world.map) {
      world.map.generate();
    }

    // Set player spawn in the middle of the arena
    if (world.player && world.map) {
      world.player.setPosition(world.map.center.x, world.map.center.z);
      if (typeof world.player.syncVisuals === "function") {
        world.player.syncVisuals();
      }
    }

    world.spawnEnemies(world.currentWaveConfig);

    world.spawnWavePickups();

    // Update hud based on wave type
    if (world.hud) {
      let label =
        world.currentWaveConfig.type === "protect"
          ? `Protect Wave ${world.wave}`
          : `Wave ${world.wave}`;
      world.hud.setMessage(label);
    }

    // Go to new state based on wave type
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
