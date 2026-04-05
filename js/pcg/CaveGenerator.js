export class CaveGenerator {

  // Generate our cave grid with 1s and 0s
  static generate(map, numIterations, density, maxAttempts = 10) {

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let grid = this.initGrid(map, density);

      for (let i = 0; i < numIterations; i++) {
        grid = this.applyCA(grid);
      }

      if (this.validate(grid)) {
        return grid;
      }
    }
    throw new Error("We could not generate a valid grid");
  
  }

  // Initialize our grid with noise
  static initGrid(map, density) {
    let grid = [];

    for (let r = 0; r < map.rows; r++) {
      let row = [];
      for (let c = 0; c < map.cols; c++) {
        let cell = Math.random() < density ? 1 : 0;
        row.push(cell);
      }
      grid.push(row);
    }
    return grid;
  }

  // Count the surrounding obstacles (8 neighbours)
  // Ignoring the center
  // If it is out of bounds, we will consider it an obstacle
  static countObstacles(grid, r, c) {
    let count = 0;
    let rows = grid.length;
    let cols = grid[0].length;

    // Iterate over directions of neighbours
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {

        let nr = r + dr;
        let nc = c + dc;

        // If it is the center tile/index ignore
        if (dr === 0 && dc === 0) continue;

       // Count
        if (
          // Option 2: if cell is out of bounds, consider it an obstacle
          nr < 0 || nr >= rows ||
          nc < 0 || nc >= cols ||
          // If cell is 1, increase count
          grid[nr][nc] === 1
        ) {
          count++;
        }
      }
    }
    return count;
  }


  // Apply one iteration of CA
  static applyCA(grid) {
    let nextGrid = [];

    for (let r = 0; r < grid.length; r++) {
      let row = [];

      for (let c = 0; c < grid[0].length; c++) {

        let newCell;

        // Option 1: set all border cells to obstacles
        // if (
        //   r === 0 ||
        //   c === 0 ||
        //   r === grid.length - 1 ||
        //   c === grid[0].length - 1
        // ) {
        //   newCell = 1;
        // } else {

        // Count the obstacles
        let obsCount = this.countObstacles(grid, r, c);

        if (obsCount > 4) newCell = 1;
        else if (obsCount < 4) newCell = 0;
        else newCell = grid[r][c];

        // }
      row.push(newCell);
      }
      nextGrid.push(row);
    }
    return nextGrid;

  }

  // Validate to ensure all open cells are connected
  static validate(grid) {
    let rows = grid.length;
    let cols = grid[0].length;

    let start = null;
    let total = 0;

    // Get the start cell and the total number of open cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === 0) {
          total++;
          if (!start) start = [r, c];
        }
      }
    }

    // If we don't have a start, it's already invalid
    if (!start) return false;

    // Otherwise run BFS
    let visited = new Set();
    let queue = [start];

    // Keep track of the flattened index
    visited.add(start[0] * cols + start[1]);

    while (queue.length > 0) {

      let [r, c] = queue.shift();
    
      for (let [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        let nr = r + dr;
        let nc = c + dc;

        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
          grid[nr][nc] === 0 && !visited.has(nr * cols + nc)) {

            visited.add(nr * cols + nc);
            queue.push([nr, nc]);
        }
      }
    }

    return visited.size === total;
  }

}                  