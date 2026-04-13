import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

export function createModelInstance(
  template,
  { targetHeight = 1, targetFootprint = null, yaw = 0 } = {}
) {
  // Return empty result if asset is not loaded yet
  if (!template) {
    return { model: null, clips: [] };
  }

  // Clone template so each entity can own its own model instance
  let source = template.scene ?? template;
  let clips = template.animations ?? [];
  let instance = clone(source);
  instance.rotation.y = yaw;

  instance.traverse((child) => {
    if (child.isMesh) {
      // Leave mesh shadow settings from the source model unchanged
    }
  });

  // Scale model to fit desired height or footprint
  let initialBounds = new THREE.Box3().setFromObject(instance);
  if (!initialBounds.isEmpty()) {
    let size = new THREE.Vector3();
    initialBounds.getSize(size);

    let footprint = Math.max(size.x, size.z);
    if (targetFootprint && footprint > 0.0001) {
      let scale = targetFootprint / footprint;
      instance.scale.multiplyScalar(scale);
    } else if (size.y > 0.0001) {
      let scale = targetHeight / size.y;
      instance.scale.multiplyScalar(scale);
    }
  }

  instance.updateMatrixWorld(true);

  // Recenter model around origin and place bottom on ground
  let fittedBounds = new THREE.Box3().setFromObject(instance);
  if (!fittedBounds.isEmpty()) {
    let center = new THREE.Vector3();
    fittedBounds.getCenter(center);
    instance.position.x -= center.x;
    instance.position.z -= center.z;
    instance.position.y -= fittedBounds.min.y;
  }

  instance.updateMatrixWorld(true);
  return {
    model: instance,
    clips
  };
}

export function pickDefaultAnimationClip(clips) {
  // Return no animation if model has no clips
  if (!clips?.length) {
    return null;
  }

  // Prefer movement/idle-style clips if names are available
  let preferredPatterns = [
    /idle/i,
    /hover/i,
    /fly/i,
    /walk/i,
    /run/i,
    /animation/i
  ];

  // Pick first matching preferred animation
  for (let pattern of preferredPatterns) {
    let match = clips.find((clip) => pattern.test(clip.name));
    if (match) {
      return match;
    }
  }

  // Fall back to first clip if none match
  return clips[0];
}
