# Contribution Summary

## Daniel

- Implemented Jump Point Search pathfinding integration for protect waves.
- Implemented the procedural tile-map arena generation and rendering flow, including regenerated arenas, obstacle placement, and map connectivity checks.
- Implemented player gameplay features, including movement, aiming, shooting, score multiplier handling, health handling, and the `Shift` double-damage ability with cooldown.
- Implemented the intro/start flow using `IntroState`, including the start screen text and begin button before the first wave starts.
- Integrated the HUD features, including health, score, enemies, wave, score multiplier, damage boost status, messages, and the intro overlay.
- Added comments and cleanup across core gameplay/entity files to make the code easier to follow.

## Noah

- Implemented the enemy AI state flow, including patrol, chase, attack-player, and attack-objective behavior.
- Implemented the game state flow for wave setup, combat, protect waves, intermissions, and game-over handling.
- Implemented steering behavior integration for enemies, including pursue, evade, wander, arrive, separation, flocking, and wall collision avoidance.
- Implemented the main `World` game flow, including scene setup, wave updates, projectile resolution, pickup collection, cleanup, and HUD updates.
- Added and organized asset loading through `AssetLoader`, including background model loading, applying loaded models to existing entities, and fallback mesh support.
- Integrated visual rendering support for map obstacles and models through `TileMapRenderer` and `ModelUtils`.
