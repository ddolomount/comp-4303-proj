// Tile class, which is our nodes
export class Tile {
  // Possible tile types
  static Type = Object.freeze({
    Ground: Symbol("Ground"),
    Obstacle: Symbol("Obstacle")
  });

  // Map to hold costs associated with types
  static Cost = new Map([
    [Tile.Type.Ground, 1],
    [Tile.Type.Obstacle, 10]
  ]);

  // Tile constructor
  constructor(row, col, type = Tile.Type.Ground, height = 1) {
    this.row = row;
    this.col = col;
    this.type = type;
    this.height = height;
    this.cost = Tile.Cost.get(this.type);

    this.walls = {
      north: false,
      south: false,
      east: false,
      west: false
    };
  }

  // Check to see if we can walk on this tile
  isWalkable() {
    return this.type !== Tile.Type.Obstacle;
  }
}
