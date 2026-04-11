import { State } from "../../ai/decisions/State.js";

export class GameOverState extends State {
  constructor(message = "Core failure - press R to restart") {
    super();
    this.message = message;
  }

  enter(world) {
    world.gameOver = true;
    world.hud.setMessage(this.message, true);
  }

  update(world, dt) {
    if (world.input.consumeRestart()) {
      world.restart();
    }
  }

  exit(world) {
    world.gameOver = false;
  }
}
