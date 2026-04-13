export class AStar {
  // Heuristic functions
  static manhattan(start, end, tileSize) {
    let dRow = Math.abs(start.row - end.row);
    let dCol = Math.abs(start.col - end.col);

    return (dRow + dCol) * tileSize;
  }

  static diagonal(start, end, tileSize) {
    let dRow = Math.abs(start.row - end.row);
    let dCol = Math.abs(start.col - end.col);

    let minD = Math.min(dRow, dCol);
    let maxD = Math.max(dRow, dCol);

    return (minD * Math.SQRT2 + (maxD - minD)) * tileSize;
  }

  static euclidian(start, end, tileSize) {
    let dRow = Math.abs(start.row - end.row);
    let dCol = Math.abs(start.col - end.col);

    return Math.sqrt(dRow * dRow + dCol * dCol) * tileSize;
  }
}
