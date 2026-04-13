import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

export function createModelInstance(
  template,
  { targetHeight = 1, targetFootprint = null, yaw = 0 } = {}
) {
  if (!template) {
    return { model: null, clips: [] };
  }

  let source = template.scene ?? template;
  let clips = template.animations ?? [];
  let instance = clone(source);
  instance.rotation.y = yaw;

  instance.traverse((child) => {
    if (child.isMesh) {
      // child.castShadow = true;
      // child.receiveShadow = true;wdawd
    }
  });

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
  if (!clips?.length) {
    return null;
  }

  let preferredPatterns = [
    /idle/i,
    /hover/i,
    /fly/i,
    /walk/i,
    /run/i,
    /animation/i
  ];

  for (let pattern of preferredPatterns) {
    let match = clips.find((clip) => pattern.test(clip.name));
    if (match) {
      return match;
    }
  }

  return clips[0];
}
