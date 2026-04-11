import * as THREE from "three";

/**
 * Input handler handles camera-relative WASD movement
 * and the extra pointer/game actions used by the project.
 */
export class InputHandler {
  constructor(camera, domElement = null) {
    this.camera = camera;
    this.domElement =
      domElement ?? (typeof window !== "undefined" ? window : null);

    // Track which WASD keys are pressed
    this.keys = { w: false, a: false, s: false, d: false };
    this.mouseDown = false;
    this.mouse = new THREE.Vector2();
    this.pointerWorld = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.restartRequested = false;

    // Listen for key down events and mark keys as pressed
    window.addEventListener("keydown", (e) => {
      let key = e.key.toLowerCase();
      if (key in this.keys) this.keys[key] = true;

      if (e.code === "KeyR") {
        this.restartRequested = true;
      }
    });

    // Listen for key up events and mark keys as not pressed
    window.addEventListener("keyup", (e) => {
      let key = e.key.toLowerCase();
      if (key in this.keys) this.keys[key] = false;
    });

    window.addEventListener("pointermove", (event) => {
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener("pointerup", () => {
      this.mouseDown = false;
    });

    if (this.domElement) {
      this.domElement.addEventListener("pointerdown", () => {
        this.mouseDown = true;
      });
    }
  }

  // Returns a force vector based on pressed keys and camera direction
  getForce(strength = 1) {
    let force = new THREE.Vector3();

    // WASD for forward/back/left/right movement
    if (this.keys.w) force.z += 1;
    if (this.keys.s) force.z -= 1;
    if (this.keys.a) force.x += 1;
    if (this.keys.d) force.x -= 1;

    // Only process if there is input
    if (force.length() > 0) {
      // Get the direction the camera is facing
      let cameraDirection = new THREE.Vector3();
      this.camera.getWorldDirection(cameraDirection);
      cameraDirection.y = 0;

      // Calculate camera rotation angle and apply it to the force
      let cameraAngle = Math.atan2(cameraDirection.x, cameraDirection.z);
      force.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle);

      // Set force to strength argument
      force.setLength(strength);
    }

    return force;
  }

  getMovementVector() {
    return this.getForce(1);
  }

  updatePointerWorld(camera = this.camera) {
    this.camera = camera;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    this.raycaster.ray.intersectPlane(this.floorPlane, this.pointerWorld);
  }

  consumeRestart() {
    const requested = this.restartRequested;
    this.restartRequested = false;
    return requested;
  }
}
