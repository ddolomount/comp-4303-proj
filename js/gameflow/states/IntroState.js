import { State } from "../../ai/decisions/State.js";
import { WaveSetupState } from "./WaveSetupState.js";

export class IntroState extends State {
  enter(world) {
    world.hud.showIntro(() => {
      world.gameStateMachine.change(new WaveSetupState());
    });
  }

  update(world, dt) {}

  exit(world) {
    world.hud.hideIntro();
  }
}
