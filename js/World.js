import * as THREE from 'three';
import * as Setup from './setup.js';


/**
 * World class holds all information about our game's world
 */
export class World {

  // Creates a world instance
  constructor() {
    this.scene = Setup.createScene();
    this.camera = Setup.createCamera();
    this.renderer = Setup.createRenderer();
    
    this.clock = new THREE.Clock();
  }

  // Initialize objects in our world
  init() {
    this.map = new Map();

    Setup.createLight(this.scene);
    Setup.showHelpers(this.scene, this.camera, this.renderer, this.map);
  }

  update() {

  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
