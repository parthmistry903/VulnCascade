import { describe, expect, it } from "vitest";
import { computeBlastRadius } from "@/algorithms/blast-radius";
import type { GraphEdge, GraphNode } from "@/lib/types";

const nodes: Array<Pick<GraphNode, "id" | "name" | "isRoot">> = [
  { id: "root", name: "project", isRoot: true },
  { id: "npm:a", name: "a" },
  { id: "npm:b", name: "b" },
  { id: "npm:c", name: "c" }
];

const edges: GraphEdge[] = [
  { source: "root", target: "npm:a", type: "depends_on" },
  { source: "npm:a", target: "npm:b", type: "depends_on" },
  { source: "npm:b", target: "npm:c", type: "depends_on" }
];

describe("computeBlastRadius", () => {
  it("walks reverse dependency edges with BFS depth", () => {
    // The radius is everything that would be affected by a flaw in "c", which is
    // every dependent above it — the source package itself is excluded, and the
    // project root is included because it transitively depends on "c" too.
    expect(computeBlastRadius("npm:c", nodes, edges)).toEqual([
      { packageId: "npm:b", packageName: "b", depth: 1 },
      { packageId: "npm:a", packageName: "a", depth: 2 },
      { packageId: "root", packageName: "project", depth: 3 }
    ]);
  });

  it("returns an empty radius for a package nothing depends on", () => {
    expect(computeBlastRadius("root", nodes, edges)).toEqual([]);
  });

  it("counts a shared dependency once per dependent, not once per path", () => {
    const diamondNodes: Array<Pick<GraphNode, "id" | "name" | "isRoot">> = [
      { id: "root", name: "project", isRoot: true },
      { id: "npm:left", name: "left" },
      { id: "npm:right", name: "right" },
      { id: "npm:shared", name: "shared" }
    ];
    const diamondEdges: GraphEdge[] = [
      { source: "root", target: "npm:left", type: "depends_on" },
      { source: "root", target: "npm:right", type: "depends_on" },
      { source: "npm:left", target: "npm:shared", type: "depends_on" },
      { source: "npm:right", target: "npm:shared", type: "depends_on" }
    ];

    const radius = computeBlastRadius("npm:shared", diamondNodes, diamondEdges);
    expect(radius.map((entry) => entry.packageId)).toEqual(["npm:left", "npm:right", "root"]);
    expect(radius.filter((entry) => entry.packageId === "root")).toHaveLength(1);
  });
});
