import { State } from "../../ai/decisions/State.js";
import { WaveSetupState } from "./WaveSetupState.js";

export class IntermissionState extends State {
  enter(world) {
    world.pendingWaveTimer = 0;
    world.arenaRegenerated = false;
    world.hud.setMessage("Wave cleared");
  }

  update(world, dt) {
    world.pendingWaveTimer += dt;

    // Update hud
    if (!world.arenaRegenerated && world.pendingWaveTimer > 1.2) {
      world.hud.setMessage("Map rerouting");
      world.arenaRegenerated = true;
    }

    if (world.pendingWaveTimer > 2.4) {
      world.gameStateMachine.change(new WaveSetupState());
    }
  }

  exit(world) {}
}
