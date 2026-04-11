export class State {
  constructor() {
    if (new.target === State) {
      throw new Error("Cannot instantiate abstract class State");
    }
  }

  enter() {
    throw new Error("enter() must be implemented");
  }

  update() {
    throw new Error("update() must be implemented");
  }

  exit() {
    throw new Error("exit() must be implemented");
  }
}
