import { State } from '../../ai/decisions/State.js';

export class GameOverState extends State {
  enter(world) {
    world.gameOver = true;
    world.hud.setMessage('Core failure - press R to restart', true);
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
