import * as THREE from 'three';

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#04110f');
  scene.fog = new THREE.Fog('#04110f', 45, 130);
  return scene;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    250
  );

  camera.position.set(0, 34, 10);
  return camera;
}

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  return renderer;
}

export function createLights(scene) {
  const hemi = new THREE.HemisphereLight('#9fffe8', '#020705', 1.1);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#d8fff6', 1.8);
  sun.position.set(20, 40, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 150;
  sun.shadow.camera.left = -50;
  sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50;
  sun.shadow.camera.bottom = -50;
  scene.add(sun);

  return { hemi, sun };
}

export function installPageStyles() {
  const style = document.createElement('style');
  style.textContent = `
    :root {
      color-scheme: dark;
      --bg: rgba(2, 10, 9, 0.74);
      --panel: rgba(6, 26, 22, 0.84);
      --border: rgba(85, 255, 213, 0.24);
      --ink: #d9fff4;
      --accent: #58ffd4;
      --danger: #ff7269;
      --warning: #ffd84f;
      --muted: #89bcb0;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      overflow: hidden;
      cursor: crosshair;
      background:
        radial-gradient(circle at top, rgba(15, 81, 63, 0.42), transparent 40%),
        linear-gradient(180deg, #071513 0%, #020605 100%);
      color: var(--ink);
      font-family: "Trebuchet MS", "Segoe UI", sans-serif;
    }

    canvas {
      display: block;
    }

    .hud {
      position: fixed;
      inset: 0;
      pointer-events: none;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20px;
      gap: 16px;
    }

    .hud__panel {
      min-width: 220px;
      padding: 14px 16px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: linear-gradient(180deg, var(--panel), var(--bg));
      backdrop-filter: blur(10px);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
    }

    .hud__title {
      font-size: 14px;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 10px;
    }

    .hud__stat {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-top: 8px;
      font-size: 16px;
    }

    .hud__value {
      color: var(--accent);
      font-weight: 700;
    }

    .hud__message {
      position: fixed;
      left: 50%;
      top: 24px;
      transform: translateX(-50%);
      min-width: min(560px, calc(100vw - 32px));
      padding: 14px 20px;
      text-align: center;
      font-size: 18px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: rgba(4, 17, 15, 0.84);
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.35);
    }

    .hud__message.hidden {
      display: none;
    }

    @media (max-width: 720px) {
      .hud {
        flex-direction: column;
        align-items: stretch;
        padding: 12px;
      }

      .hud__panel {
        min-width: 0;
      }

      .hud__message {
        top: auto;
        bottom: 16px;
        font-size: 15px;
      }
    }
  `;

  document.head.appendChild(style);
}
