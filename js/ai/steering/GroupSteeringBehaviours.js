import * as THREE from 'three';
import { SteeringBehaviours } from './SteeringBehaviours.js';

// Namespace for group steering behaviours
export class GroupSteeringBehaviours {

  // Separate
  static separate(entity, others, radius) {

    let count = 0;
    let steer = new THREE.Vector3();

    // For all other entities
    for (let other of others) {
      
      // if the entity is our current npc, 
      // continue
      if (other === entity) continue;

      let offset = entity.position.clone().sub(other.position);
      let distance = offset.length();

      // If we are within the distance
      // where we need to separate
      // add the offset to our steering vector
      if (distance > 0 && distance < radius) {

        offset.setLength(1/distance);
        steer.add(offset);
        count++;

      }
    }

    // If we have added vectors
    // to our steering force
    if (count > 0) {
      steer.divideScalar(count);
      steer.setLength(entity.topSpeed);
      steer.sub(entity.velocity);
    }
    
    return steer;
  }


  // Align steering behaviour
  // This will get all of the entities
  // within a radius moving in a similar direction
  static align(entity, others, radius) {

    let count = 0;
    let desired = new THREE.Vector3();

    for (let other of others) {

      if (other === entity) continue;

      let distance = entity.position.distanceTo(other.position);

      if (distance < radius) {
        desired.add(other.velocity);
        count++;
      }

    }

    if (count > 0) {
      desired.divideScalar(count);
      if (desired.lengthSq() === 0) {
        return new THREE.Vector3();
      }
      desired.setLength(entity.topSpeed);
      desired.sub(entity.velocity);
    }
    return desired;
  }


  // Cohesion will get us to steer toward
  // the center of all other entities
  static cohesion(entity, others, radius) {

    let count = 0;
    let center = new THREE.Vector3();

    for (let other of others) {
      if (other === entity) continue;

      let distance = entity.position.distanceTo(other.position);
      if (distance < radius) {
        center.add(other.position);
        count++;
      }
    }

    if (count > 0) {
      center.divideScalar(count);
      return SteeringBehaviours.seek(entity, center);
    }

    return new THREE.Vector3(0,0,0);

  }

  // Generate the steering force
  // For flocking!
  static flock(entity, others, 
    {
     separationRadius = 3,
     separationWeight = 1,
     alignmentRadius = 4,
     alignmentWeight = 1,
     cohesionRadius = 5,
     cohesionWeight = 1
    } = {}) {
      
      let steer = new THREE.Vector3();

      let separate = GroupSteeringBehaviours.separate(
        entity,
        others,
        separationRadius
      );
      separate.multiplyScalar(separationWeight);
      steer.add(separate);

      let align = GroupSteeringBehaviours.align(
        entity,
        others,
        alignmentRadius
      );
      align.multiplyScalar(alignmentWeight);
      steer.add(align);

      let cohesion = GroupSteeringBehaviours.cohesion(
        entity,
        others,
        cohesionRadius
      );
      cohesion.multiplyScalar(cohesionWeight);
      steer.add(cohesion);

      return steer;
    }



}
