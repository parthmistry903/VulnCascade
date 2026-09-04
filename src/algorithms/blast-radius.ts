import type { BlastRadiusEntry, GraphEdge, GraphNode } from "@/lib/types";

export function computeBlastRadius(
  sourceId: string,
  nodes: Array<Pick<GraphNode, "id" | "name" | "isRoot">>,
  edges: GraphEdge[]
): BlastRadiusEntry[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const reverseAdjacency = new Map<string, string[]>();

  for (const edge of edges) {
    const dependents = reverseAdjacency.get(edge.target) ?? [];
    dependents.push(edge.source);
    reverseAdjacency.set(edge.target, dependents);
  }

  const visited = new Set<string>([sourceId]);
  const queue: Array<{ id: string; depth: number }> = [{ id: sourceId, depth: 0 }];
  const radius: BlastRadiusEntry[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const node = nodeById.get(current.id);
    if (node && current.depth > 0) {
      radius.push({
        packageId: node.id,
        packageName: node.name,
        depth: current.depth
      });
    }

    for (const dependentId of reverseAdjacency.get(current.id) ?? []) {
      if (!visited.has(dependentId)) {
        visited.add(dependentId);
        queue.push({ id: dependentId, depth: current.depth + 1 });
      }
    }
  }

  return radius;
}
