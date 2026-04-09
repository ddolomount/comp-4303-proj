import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export function createModelInstance(template, {
  targetHeight = 1,
  yaw = 0,
} = {}) {
  if (!template) {
    return { model: null, clips: [] };
  }

  const source = template.scene ?? template;
  const clips = template.animations ?? [];
  const instance = clone(source);
  instance.rotation.y = yaw;

  instance.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const initialBounds = new THREE.Box3().setFromObject(instance);
  if (!initialBounds.isEmpty()) {
    const size = new THREE.Vector3();
    initialBounds.getSize(size);

    if (size.y > 0.0001) {
      const scale = targetHeight / size.y;
      instance.scale.multiplyScalar(scale);
    }
  }

  instance.updateMatrixWorld(true);

  const fittedBounds = new THREE.Box3().setFromObject(instance);
  if (!fittedBounds.isEmpty()) {
    const center = new THREE.Vector3();
    fittedBounds.getCenter(center);
    instance.position.x -= center.x;
    instance.position.z -= center.z;
    instance.position.y -= fittedBounds.min.y;
  }

  instance.updateMatrixWorld(true);
  return {
    model: instance,
    clips,
  };
}

export function pickDefaultAnimationClip(clips) {
  if (!clips?.length) {
    return null;
  }

  const preferredPatterns = [
    /idle/i,
    /hover/i,
    /fly/i,
    /walk/i,
    /run/i,
    /animation/i,
  ];

  for (const pattern of preferredPatterns) {
    const match = clips.find((clip) => pattern.test(clip.name));
    if (match) {
      return match;
    }
  }

  return clips[0];
}
