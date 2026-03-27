import * as THREE from 'three';

export class InputController {
  constructor(domElement) {
    this.domElement = domElement;
    this.keys = new Set();
    this.mouseDown = false;
    this.mouse = new THREE.Vector2();
    this.pointerWorld = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.restartRequested = false;

    window.addEventListener('keydown', (event) => {
      this.keys.add(event.code);
      if (event.code === 'KeyR') {
        this.restartRequested = true;
      }
    });

    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });

    window.addEventListener('pointermove', (event) => {
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    domElement.addEventListener('pointerdown', () => {
      this.mouseDown = true;
    });

    window.addEventListener('pointerup', () => {
      this.mouseDown = false;
    });
  }

  updatePointerWorld(camera) {
    this.raycaster.setFromCamera(this.mouse, camera);
    this.raycaster.ray.intersectPlane(this.floorPlane, this.pointerWorld);
  }

  getMovementVector() {
    const vector = new THREE.Vector3();
    if (this.keys.has('KeyW')) {
      vector.z -= 1;
    }
    if (this.keys.has('KeyS')) {
      vector.z += 1;
    }
    if (this.keys.has('KeyA')) {
      vector.x -= 1;
    }
    if (this.keys.has('KeyD')) {
      vector.x += 1;
    }
    return vector.normalize();
  }

  consumeRestart() {
    const requested = this.restartRequested;
    this.restartRequested = false;
    return requested;
  }
}
