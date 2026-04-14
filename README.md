# COMP 4303 AI for Games Project

## Project Description

This project is a top-down arena survival game built with Three.js. The player fights waves of virus-like enemies in a procedurally generated PCB-themed arena. Enemies use steering behaviours, state machines, collision avoidance, and pathfinding to move through the map, chase the player, attack, and complete protect-round objectives.

The game begins with a short intro screen explaining that viruses are attacking the motherboard. After the player clicks the begin button, the game alternates between normal combat waves and protect waves. In normal waves, the player clears all enemies to advance. On every third wave, a protect objective (CPU) spawns near the player and enemies attempt to reach and destroy it.

## How to Run

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the local server:

   ```bash
   npx vite
   ```

3. Open the game in a browser:

   ```text
   http://localhost:5173
   ```

## Controls
- `Begin` button: Start the game from the intro screen
- `W`, `A`, `S`, `D`: Move the player around the map
- `Mouse movement`: Aim
- `Left click`: Shoot
- `Shift`: Activate a temporary double-damage boost when it is off cooldown
- `R`: Restart after game over

## Gameplay Notes

- Clear all enemies to complete a wave.
- Pickups can restore health or temporarily increase score gain.
- The player can press `Shift` to temporarily double projectile damage. The HUD shows when this ability is active, on cooldown, or ready.
- Protect waves occur on waves 3, 6, 9, and so on.
- During protect waves, the CPU objective spawns within a few tiles of the player. If the player or protect objective reaches 0 health, the game ends.
- The arena regenerates between waves, so movement and pathfinding scenarios change throughout the game.

## Implemented AI Topics

| Topic | Where It Is Implemented | How to View It in the Application |
| --- | --- | --- |
| Complex movement algorithms: collision avoidance | `js/ai/steering/CollisionAvoidSteering.js`, used by enemy states in `js/ai/decisions/EnemyStates` | Watch enemies steer around arena walls while wandering, chasing, attacking, or moving toward the protect objective. This is easiest to see when enemies approach narrow passages. |
| Decision making: state machine | `js/ai/decisions/StateMachine.js`, `js/ai/decisions/EnemyStates/`, `js/gameflow/states/` | Enemies switch between patrol, chase, attack playey, and attack objective behaviour. Enemy behaviour can be observed by approaching an enemy that is wandering around the map or by observing their behaviour during protect waves. The The game also switches between intro, wave setup, combat, protect, intermission, and game-over states. This behaviour can be observed as the player progresses through the waves. |
| Pathfinding: Jump Point Search | `js/ai/pathfinding/JPS.js`, with the Manhattan heuristic in `js/ai/pathfinding/AStar.js`, used by `js/ai/decisions/EnemyStates/AttackObjectiveState.js` | Reach a protect wave, starting on wave 3. Enemies compute paths through the tile map toward the protect objective instead of only chasing the player directly. |
| Procedural content generation: cave generation via cellular automata | `js/pcg/CaveGenerator.js`, used by `js/maps/TileMap.js` | The arena layout is regenerated for each wave. The obstacle/ground pattern is created with cellular automata and validated so the open space remains connected. |
| Simple movement algorithms: pursue, evade, wander, arrive, separate, flock | `js/ai/steering/SteeringBehaviours.js`, `js/ai/steering/GroupSteeringBehaviours.js`, used by enemy states | Patrol enemies wander, chase enemies pursue the player, ranged enemies evade when too close, melee enemies arrive at attack distance, enemies separate to avoid stacking, and groups use flocking-style alignment/cohesion/separation while moving. |

## Main Source Areas

| Area | Files |
| --- | --- |
| Game setup and update loop | `js/main.js`, `js/World.js` |
| Map generation and rendering | `js/maps/TileMap.js`, `js/pcg/CaveGenerator.js`, `js/renderers/TileMapRenderer.js` |
| Player, enemies, projectiles, pickups, objective | `js/entities/` |
| Asset loading and model utilities | `js/loaders/AssetLoader.js`, `js/loaders/ModelUtils.js` |
| Steering behaviours | `js/ai/steering/` |
| Decision making and states | `js/ai/decisions/`, `js/gameflow/states/` |
| Pathfinding | `js/ai/pathfinding/JPS.js`, `js/ai/pathfinding/AStar.js` |
| HUD | `js/ui/Hud.js` |

## Algorithm Adaptation Notes

- Collision avoidance was changed from the in-class round-obstacle / wall-segment version into a whisker-based tile-map version. Enemies cast short whiskers, sample for wall collisions using the map’s `collidesCircle` helper, and steer away from the nearest wall normal. This fit the project better because obstacles are grid tiles rather than manually defined circular obstacles or wall line segments.

## Asset Credits

The following external 3D assets were used from Sketchfab:

| Asset | Creator | Source | License | Notes |
| --- | --- | --- | --- | --- |
| Rodot 5000 - Flying Robot | Alexandre Lion | https://sketchfab.com/3d-models/rodot-5000-flying-robot-7a1e77ed31c04e6eb54889b3e1ab0d6c | CC BY 4.0 | Used for the player model |
| Chopper Robot Low Poly | Abel099 | https://sketchfab.com/3d-models/chopper-robot-low-poly-796db68075ed4f5e94998d1f9c696284 | CC BY 4.0 | Used for melee enemy model |
| Dalek | a.shevchuk | https://sketchfab.com/3d-models/dalek-96c6bfa9eba84191accb773924e03726 | CC BY 4.0 | Used for ranged enemy model |
| Health Pack | FeelsBadMan | https://sketchfab.com/3d-models/health-pack-02b68ccdecec4d12813805b8c8865bcd | CC BY 4.0 | Used for health pickup |
| Lightning Bolt | JPScott1 | https://sketchfab.com/3d-models/lightning-bolt-d25e29d520a24f8cad9bc58417d70379 | CC BY 4.0 | Used for multiplier pickup |
| Set of Electronic Elements Pack | bazylevnik0 | https://sketchfab.com/3d-models/set-of-electronic-elements-pack-8f3020ea3aeb4067aed2cfd2c771b9e6 | CC BY 4.0 | Used for PCB obstacle models |
| Intel CPU | Mr_Assembly0 | https://sketchfab.com/3d-models/intel-cpu-b13e35727e404b2b9fd3ea64c083ff2e | CC BY 4.0 | Used for protect objective |

## Contribution Document

A .md file describing each group members contributions can be found in `contribution.md`.
