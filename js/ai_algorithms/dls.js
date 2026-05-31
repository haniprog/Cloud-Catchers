// DLSSolver: Depth-Limited Search implementation.
// This performs a DFS limited by a depth bound and returns a successful
// route (array of node ids) when it reaches the target row within the limit.
// Start: DLSSolver class definition
// End: DLSSolver class definition
class DLSSolver {
  // Performs a depth-limited search on the cloudGraph starting from startNode.
  // Returns an array representing the path if successful, otherwise null.
  depthLimitedSearch(cloudGraph, startNode, depthLimit) {
    const targetRow = Math.min(depthLimit, cloudGraph.goalRow);

    // recurse is a standard DFS that stops when depthRemaining hits 0
    // and the current node is at or beyond the target row.
    const recurse = (nodeId, depthRemaining, path, visited) => {
      if (depthRemaining === 0) {
        if (cloudGraph.getRow(nodeId) >= targetRow) {
          // DLS ends successfully when we've reached the target row.
          return path;
        }
        return null;
      }

      // Sort neighbors to prefer nodes that progress upward and are centered.
      const neighbors = [...cloudGraph.getReachableNodes(nodeId)].sort((left, right) => {
        const leftRow = cloudGraph.getRow(left);
        const rightRow = cloudGraph.getRow(right);
        const center = Math.floor(cloudGraph.width / 2);
        const leftDistance = Math.abs(cloudGraph.getNodePosition(left)[0] - center);
        const rightDistance = Math.abs(cloudGraph.getNodePosition(right)[0] - center);
        return leftRow - rightRow || leftDistance - rightDistance;
      });

      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) {
          continue;
        }

        visited.add(neighborId);
        const result = recurse(neighborId, depthRemaining - 1, [...path, neighborId], visited);
        if (result) {
          return result;
        }
        visited.delete(neighborId);
      }

      return null;
    };

    return recurse(startNode, depthLimit, [startNode], new Set([startNode]));
  }
}

window.DLSSolver = DLSSolver;
