import { World } from "./World.js";

let world = new World();
world.init();

// Animate loop
function loop() {
  requestAnimationFrame(loop);

  world.update();
  world.render();
}

loop();
