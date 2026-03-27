export class StateMachine {
  constructor(entity, initState) {
    this.entity = entity;
    this.state = initState;
  }

  change(newState) {
    this.state.exit(this.entity);
    this.state = newState;
    this.state.enter(this.entity);
  }

  update(dt) {
    this.state.update(this.entity, dt);
  }
}
