// BFSSolver: Breadth-First Search utility used to validate reachability
// Start: BFSSolver class definition
// End: BFSSolver class definition
class BFSSolver {
  // Checks whether a given node sequence (route) is actually reachable
  // across the provided CloudGraph using BFS.
  isSequenceSurvivable(cloudGraph, route) {
    if (!route || !route.length) {
      return false;
    }

    // BFS starts here: expand outward level-by-level from the route start
    const goal = route[route.length - 1];
    const visited = new Set([route[0]]);
    const queue = [route[0]];

    while (queue.length) {
      const current = queue.shift();
      if (current === goal) {
        return true;
      }

      for (const neighbor of cloudGraph.getReachableNodes(current)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    // BFS ends when queue is exhausted without finding the goal.
    return false;
  }
}

// expose globally
window.BFSSolver = BFSSolver;
