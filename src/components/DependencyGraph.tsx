"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Crosshair, Filter, Minus, Plus, RotateCcw, X } from "lucide-react";
import { RiskBadge } from "@/components/RiskBadge";
import { riskClass } from "@/lib/risk";
import type { GraphData, GraphEdge, GraphNode, RiskLabel } from "@/lib/types";

interface DependencyGraphProps {
  graphData: GraphData;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

interface SimNode extends GraphNode, d3.SimulationNodeDatum {}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
  type: GraphEdge["type"];
}

interface TooltipState {
  x: number;
  y: number;
  flipX: boolean;
  flipY: boolean;
  node: GraphNode;
}

type SeverityFilter = "ALL" | RiskLabel;

const RISK_COLORS = {
  clean: "#27AE60",
  low: "#f59e0b",
  medium: "#E67E22",
  high: "#ef4444",
  critical: "#991b1b"
};

const ARROW_LENGTH = 12;
const LABEL_NODE_BUDGET = 45;
const LABEL_MIN_SCALE = 0.55;
const TOOLTIP_WIDTH = 280;
const TOOLTIP_HEIGHT = 150;

export function DependencyGraph({ graphData, selectedNodeId, onSelectNode }: DependencyGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const minimapRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [hideClean, setHideClean] = useState(false);
  const [minRisk, setMinRisk] = useState(0);
  const [severity, setSeverity] = useState<SeverityFilter>("ALL");
  const [highlightOnly, setHighlightOnly] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [size, setSize] = useState({ width: 900, height: 560 });

  // Persistent d3 state. None of this lives in React state: touching it must
  // never re-run the effect that builds the graph, or the layout restarts.
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const layersRef = useRef<{
    root: d3.Selection<SVGGElement, unknown, null, undefined>;
    links: d3.Selection<SVGGElement, unknown, null, undefined>;
    nodes: d3.Selection<SVGGElement, unknown, null, undefined>;
  } | null>(null);
  // Survives filtering, selection and resize so nodes keep their places.
  const positionsRef = useRef(new Map<string, { x: number; y: number; fx?: number; fy?: number }>());
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const hoverIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(selectedNodeId);
  const blastIdsRef = useRef<Set<string>>(new Set());
  const restyleRef = useRef<() => void>(() => {});
  const fitRef = useRef<(duration?: number) => void>(() => {});
  const didInitialFitRef = useRef(false);
  const draggedRef = useRef(false);

  const selectedNode = useMemo(
    () => graphData.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [graphData.nodes, selectedNodeId]
  );

  const blastRadiusIds = useMemo(() => {
    if (!selectedNode) {
      return new Set<string>();
    }
    return new Set(selectedNode.blastRadius.map((entry) => entry.packageId));
  }, [selectedNode]);

  // Derived, not stored: "blast radius only" is inert without a selection, so
  // it can never strand the graph on a filter the user cannot see or undo.
  const highlightActive = highlightOnly && Boolean(selectedNode);

  const visibleNodes = useMemo(() => {
    return graphData.nodes.filter((node) => {
      if (node.isRoot) {
        return true;
      }
      // The selected node always stays on screen — otherwise a filter change
      // would silently drop the thing the detail panel is describing.
      if (node.id === selectedNodeId) {
        return true;
      }
      if (highlightActive && !blastRadiusIds.has(node.id)) {
        return false;
      }
      if (hideClean && node.riskScore === 0) {
        return false;
      }
      if (node.riskScore < minRisk) {
        return false;
      }
      if (severity !== "ALL" && node.riskLabel !== severity) {
        return false;
      }
      return true;
    });
  }, [
    blastRadiusIds,
    graphData.nodes,
    hideClean,
    highlightActive,
    minRisk,
    selectedNodeId,
    severity
  ]);

  const visibleEdges = useMemo(() => {
    const ids = new Set(visibleNodes.map((node) => node.id));
    return graphData.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
  }, [graphData.edges, visibleNodes]);

  useEffect(() => {
    selectedIdRef.current = selectedNodeId;
    blastIdsRef.current = blastRadiusIds;
    restyleRef.current();
  }, [blastRadiusIds, selectedNodeId]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      setSize({
        width: Math.max(320, Math.round(rect.width)),
        height: Math.max(360, Math.round(rect.height))
      });
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  // ---- Scaffolding: built once, never torn down by a filter or a click ----
  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) {
      return;
    }

    const svg = d3.select(svgElement);
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    defs
      .append("filter")
      .attr("id", "svg-glow")
      .attr("x", "-200%")
      .attr("y", "-200%")
      .attr("width", "500%")
      .attr("height", "500%")
      .append("feGaussianBlur")
      .attr("stdDeviation", "10")
      .attr("result", "blur");

    for (const [id, fill] of [
      ["arrowhead", "#000000"],
      ["arrowhead-active", "#0f766e"]
    ] as const) {
      defs
        .append("marker")
        .attr("id", id)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 10)
        .attr("refY", 0)
        .attr("markerUnits", "userSpaceOnUse")
        .attr("markerWidth", ARROW_LENGTH)
        .attr("markerHeight", ARROW_LENGTH)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", fill);
    }

    const root = svg.append("g").attr("class", "graph-root");
    const links = root.append("g").attr("class", "graph-links");
    const nodes = root.append("g").attr("class", "graph-nodes");
    layersRef.current = { root, links, nodes };

    const simulation = d3
      .forceSimulation<SimNode, SimLink>([])
      .force("link", d3.forceLink<SimNode, SimLink>([]).id((node) => node.id).distance(110).strength(0.7))
      .force("charge", d3.forceManyBody().strength(-430))
      .force("collide", d3.forceCollide<SimNode>().radius((node) => radiusForNode(node) + 24))
      .velocityDecay(0.35)
      .alphaDecay(0.028);
    simRef.current = simulation;

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        root.attr("transform", event.transform.toString());
        // Labels thin out as you zoom away, so dense graphs stay readable.
        restyleRef.current();
      });
    zoomRef.current = zoomBehavior;
    svg.call(zoomBehavior);
    // Double-click is "unpin this node", not "zoom in".
    svg.on("dblclick.zoom", null);
    // Clicking empty canvas clears the selection.
    svg.on("click", (event: MouseEvent) => {
      if (event.target === svgElement) {
        onSelectNode(null);
      }
    });

    return () => {
      simulation.stop();
      svg.on(".zoom", null);
      svg.on("click", null);
      simRef.current = null;
      layersRef.current = null;
    };
  }, [onSelectNode]);

  // ---- Viewport: resize only nudges the centring forces, never rebuilds ----
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.attr("viewBox", `0 0 ${size.width} ${size.height}`);

    const simulation = simRef.current;
    if (!simulation) {
      return;
    }
    simulation
      .force("center", d3.forceCenter(size.width / 2, size.height / 2))
      .force("x", d3.forceX<SimNode>(size.width / 2).strength(0.045))
      .force("y", d3.forceY<SimNode>(size.height / 2).strength(0.045));
    if (simulation.alpha() < 0.05) {
      simulation.alpha(0.12).restart();
    }
  }, [size.height, size.width]);

  const applyZoom = useCallback((transform: d3.ZoomTransform, duration = 260) => {
    const svgElement = svgRef.current;
    const zoomBehavior = zoomRef.current;
    if (!svgElement || !zoomBehavior) {
      return;
    }
    d3.select(svgElement).transition().duration(duration).call(zoomBehavior.transform, transform);
  }, []);

  // ---- Data join: preserves positions, zoom, pins and selection ----
  useEffect(() => {
    const layers = layersRef.current;
    const simulation = simRef.current;
    if (!layers || !simulation) {
      return;
    }

    const positions = positionsRef.current;
    const rootNode = visibleNodes.find((node) => node.isRoot);
    const seedX = positions.get(rootNode?.id ?? "")?.x ?? size.width / 2;
    const seedY = positions.get(rootNode?.id ?? "")?.y ?? size.height / 2;

    const nodes: SimNode[] = visibleNodes.map((node) => {
      const saved = positions.get(node.id);
      // A brand-new node enters near the graph's centre of mass rather than
      // at d3's default phyllotaxis spiral, so nothing jumps across screen.
      const angle = Math.random() * Math.PI * 2;
      const spawn = saved ?? {
        x: seedX + Math.cos(angle) * 90,
        y: seedY + Math.sin(angle) * 90
      };
      return { ...node, ...spawn } as SimNode;
    });
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const links: SimLink[] = visibleEdges.map((edge) => ({ ...edge }));

    const linkSelection = layers.links
      .selectAll<SVGLineElement, SimLink>("line")
      .data(links, (link) => `${asId(link.source)}->${asId(link.target)}`)
      .join(
        (enter) => enter.append("line").attr("stroke-width", 2.5).attr("opacity", 0),
        (update) => update,
        (exit) => exit.transition().duration(180).attr("opacity", 0).remove()
      )
      .attr("stroke", "#000000")
      .attr("marker-end", "url(#arrowhead)");
    linkSelection.transition().duration(220).attr("opacity", 0.85);

    const nodeSelection = layers.nodes
      .selectAll<SVGGElement, SimNode>("g.graph-node")
      .data(nodes, (node) => node.id)
      .join(
        (enter) => {
          const group = enter
            .append("g")
            .attr("class", "graph-node")
            .attr("role", "button")
            .attr("tabindex", 0)
            .style("cursor", "grab")
            .style("opacity", 0);

          group.append("title");
          group.append("circle").attr("class", "node-halo").attr("fill", "none").attr("stroke-width", 14);
          group.append("circle").attr("class", "node-core").attr("stroke", "#000000").attr("stroke-width", 3);
          group
            .append("text")
            .attr("class", "node-label")
            .attr("text-anchor", "middle")
            .attr("font-family", "DM Mono")
            .attr("font-size", 11)
            .attr("font-weight", 800)
            .attr("paint-order", "stroke")
            .attr("stroke", "#FFFFFF")
            .attr("stroke-width", 4)
            .attr("fill", "#000000")
            .style("pointer-events", "none");

          group.transition().duration(240).style("opacity", 1);
          return group;
        },
        (update) => update,
        (exit) => exit.transition().duration(180).style("opacity", 0).remove()
      );

    nodeSelection.attr("aria-label", nodeAriaLabel);
    nodeSelection.select("title").text(nodeAriaLabel);
    nodeSelection.select("circle.node-halo").attr("r", (node) => radiusForNode(node) + 5);
    nodeSelection
      .select("circle.node-core")
      .attr("r", (node) => radiusForNode(node))
      .attr("fill", nodeColor);
    nodeSelection
      .select("text.node-label")
      .text((node) => (node.name.length > 18 ? `${node.name.slice(0, 16)}…` : node.name))
      .attr("dy", (node) => radiusForNode(node) + 15);

    // Handlers are rebound every join so they close over fresh data.
    nodeSelection
      .on("click", (event: PointerEvent, node) => {
        event.stopPropagation();
        // A click always fires at the end of a drag; ignore that one.
        if (draggedRef.current) {
          draggedRef.current = false;
          return;
        }
        onSelectNode(selectedIdRef.current === node.id ? null : node.id);
      })
      .on("keydown", (event: KeyboardEvent, node) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectNode(selectedIdRef.current === node.id ? null : node.id);
        }
      })
      .on("dblclick", (event: MouseEvent, node) => {
        event.stopPropagation();
        node.fx = null;
        node.fy = null;
        const saved = positionsRef.current.get(node.id);
        if (saved) {
          delete saved.fx;
          delete saved.fy;
        }
        simulation.alpha(0.3).restart();
      })
      .on("pointerenter", (event: PointerEvent, node) => {
        hoverIdRef.current = node.id;
        restyleRef.current();
        if (event.pointerType !== "touch") {
          setTooltip(buildTooltip(event, node, wrapRef.current));
        }
      })
      .on("pointermove", (event: PointerEvent, node) => {
        if (event.pointerType !== "touch") {
          setTooltip(buildTooltip(event, node, wrapRef.current));
        }
      })
      .on("pointerleave", () => {
        hoverIdRef.current = null;
        restyleRef.current();
        setTooltip(null);
      })
      .on("focus", (_event, node) => {
        hoverIdRef.current = node.id;
        restyleRef.current();
      })
      .on("blur", () => {
        hoverIdRef.current = null;
        restyleRef.current();
      });

    nodeSelection.call(
      d3
        .drag<SVGGElement, SimNode>()
        .on("start", (event, node) => {
          draggedRef.current = false;
          if (!event.active) {
            simulation.alphaTarget(0.25).restart();
          }
          node.fx = node.x;
          node.fy = node.y;
          d3.select(event.sourceEvent.currentTarget as SVGGElement).style("cursor", "grabbing");
        })
        .on("drag", (event, node) => {
          draggedRef.current = true;
          node.fx = event.x;
          node.fy = event.y;
        })
        .on("end", (event, node) => {
          if (!event.active) {
            simulation.alphaTarget(0);
          }
          // Stays pinned where you dropped it; double-click releases it.
          node.fx = event.x;
          node.fy = event.y;
          d3.select(event.sourceEvent.currentTarget as SVGGElement).style("cursor", "grab");
        })
    );

    // Restore pins recorded before the join.
    for (const node of nodes) {
      const saved = positions.get(node.id);
      if (saved?.fx != null && saved?.fy != null) {
        node.fx = saved.fx;
        node.fy = saved.fy;
      }
    }

    restyleRef.current = () => {
      const selectedId = selectedIdRef.current;
      const blastIds = blastIdsRef.current;
      const hoverId = hoverIdRef.current;
      const scale = transformRef.current.k;
      const focusId = hoverId ?? selectedId;
      const neighbours = focusId ? neighbourhood(focusId, links) : null;
      const dimming = Boolean(focusId) && nodes.length > 1;

      nodeSelection.select("circle.node-halo").attr("stroke", (node) => {
        if (node.id === selectedId) return "var(--accent-blue)";
        if (blastIds.has(node.id)) return "var(--accent-yellow)";
        return "none";
      });
      nodeSelection
        .select("circle.node-halo")
        .attr("opacity", 0.8)
        .style("filter", (node) =>
          node.id === selectedId || blastIds.has(node.id) ? "url(#svg-glow)" : "none"
        );

      nodeSelection.style("opacity", (node) => {
        if (!dimming) return 1;
        if (node.id === focusId || neighbours?.has(node.id) || blastIds.has(node.id)) return 1;
        return 0.22;
      });

      nodeSelection.select("text.node-label").attr("opacity", (node) => {
        if (node.id === focusId || node.id === selectedId || node.isRoot) return 1;
        if (scale < LABEL_MIN_SCALE) return 0;
        if (nodes.length > LABEL_NODE_BUDGET && !blastIds.has(node.id)) return 0;
        return 1;
      });

      linkSelection
        .attr("stroke", (link) =>
          isBlastLink(link, selectedId, blastIds) ? "var(--accent-yellow)" : "#000000"
        )
        .attr("marker-end", (link) =>
          isBlastLink(link, selectedId, blastIds) ? "url(#arrowhead-active)" : "url(#arrowhead)"
        )
        .attr("stroke-width", (link) => (isBlastLink(link, selectedId, blastIds) ? 3.5 : 2.5))
        .attr("opacity", (link) => {
          if (!dimming) return 0.85;
          if (!focusId) return 0.85;
          return asId(link.source) === focusId || asId(link.target) === focusId ? 0.95 : 0.12;
        });
    };

    fitRef.current = (duration = 420) => {
      const positioned = nodes.filter((node) => node.x != null && node.y != null);
      if (positioned.length === 0) {
        return;
      }
      const xs = positioned.map((node) => node.x as number);
      const ys = positioned.map((node) => node.y as number);
      const pad = 70;
      const minX = Math.min(...xs) - pad;
      const maxX = Math.max(...xs) + pad;
      const minY = Math.min(...ys) - pad;
      const maxY = Math.max(...ys) + pad;
      const scale = Math.min(2, Math.max(0.15, Math.min(size.width / (maxX - minX), size.height / (maxY - minY))));
      const transform = d3.zoomIdentity
        .translate(size.width / 2, size.height / 2)
        .scale(scale)
        .translate(-(minX + maxX) / 2, -(minY + maxY) / 2);
      applyZoom(transform, duration);
    };

    const minimap = d3.select(minimapRef.current);
    const showMinimap = nodes.length > 50;
    minimap.selectAll("*").remove();
    if (showMinimap) {
      minimap.attr("viewBox", "0 0 150 96");
      minimap.append("rect").attr("width", 150).attr("height", 96).attr("fill", "#FFFFFF");
      minimap.append("g").attr("class", "minimap-nodes").selectAll("circle").data(nodes).join("circle").attr("r", 2.5).attr("fill", nodeColor);
      minimap
        .append("rect")
        .attr("class", "minimap-viewport")
        .attr("fill", "none")
        .attr("stroke", "#0f766e")
        .attr("stroke-width", 1.5);
    }

    simulation.nodes(nodes);
    (simulation.force("link") as d3.ForceLink<SimNode, SimLink>).links(links);

    simulation.on("tick", () => {
      linkSelection
        .attr("x1", (link) => trimmed(link, "x1"))
        .attr("y1", (link) => trimmed(link, "y1"))
        .attr("x2", (link) => trimmed(link, "x2"))
        .attr("y2", (link) => trimmed(link, "y2"));

      nodeSelection.attr("transform", (node) => `translate(${node.x ?? 0},${node.y ?? 0})`);

      for (const node of nodes) {
        positions.set(node.id, {
          x: node.x ?? 0,
          y: node.y ?? 0,
          ...(node.fx != null && node.fy != null ? { fx: node.fx, fy: node.fy } : {})
        });
      }

      if (showMinimap) {
        const xs = nodes.map((node) => node.x ?? 0);
        const ys = nodes.map((node) => node.y ?? 0);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const spanX = Math.max(1, maxX - minX);
        const spanY = Math.max(1, maxY - minY);
        const project = (x: number, y: number) => ({
          cx: ((x - minX) / spanX) * 138 + 6,
          cy: ((y - minY) / spanY) * 84 + 6
        });
        minimap
          .selectAll<SVGCircleElement, SimNode>(".minimap-nodes circle")
          .attr("cx", (node) => project(node.x ?? 0, node.y ?? 0).cx)
          .attr("cy", (node) => project(node.x ?? 0, node.y ?? 0).cy);

        const transform = transformRef.current;
        const topLeft = transform.invert([0, 0]);
        const bottomRight = transform.invert([size.width, size.height]);
        const a = project(topLeft[0], topLeft[1]);
        const b = project(bottomRight[0], bottomRight[1]);
        minimap
          .select(".minimap-viewport")
          .attr("x", clamp(Math.min(a.cx, b.cx), 0, 150))
          .attr("y", clamp(Math.min(a.cy, b.cy), 0, 96))
          .attr("width", clamp(Math.abs(b.cx - a.cx), 0, 150))
          .attr("height", clamp(Math.abs(b.cy - a.cy), 0, 96));
      }
    });

    restyleRef.current();
    // A structural change deserves a gentle reheat, not a from-scratch explosion.
    simulation.alpha(Math.min(0.45, 0.12 + nodes.length * 0.004)).restart();

    if (!didInitialFitRef.current && nodes.length > 0) {
      didInitialFitRef.current = true;
      window.setTimeout(() => fitRef.current(0), 700);
    }

    return () => {
      simulation.on("tick", null);
    };
  }, [applyZoom, onSelectNode, size.height, size.width, visibleEdges, visibleNodes]);

  // Pan a freshly selected node into the clear, without touching the layout.
  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }
    const saved = positionsRef.current.get(selectedNodeId);
    if (!saved) {
      return;
    }
    const transform = transformRef.current;
    const [screenX, screenY] = transform.apply([saved.x, saved.y]);
    const panelWidth = size.width > 800 ? 440 : 0;
    const usableWidth = size.width - panelWidth;
    const margin = 60;
    const offScreen =
      screenX < margin || screenX > usableWidth - margin || screenY < margin || screenY > size.height - margin;
    if (!offScreen) {
      return;
    }
    applyZoom(
      d3.zoomIdentity
        .translate(usableWidth / 2, size.height / 2)
        .scale(transform.k)
        .translate(-saved.x, -saved.y)
    );
  }, [applyZoom, selectedNodeId, size.height, size.width]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedIdRef.current) {
        onSelectNode(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSelectNode]);

  const resetLayout = useCallback(() => {
    positionsRef.current.clear();
    const simulation = simRef.current;
    if (simulation) {
      for (const node of simulation.nodes()) {
        node.fx = null;
        node.fy = null;
      }
      simulation.alpha(0.9).restart();
    }
    applyZoom(d3.zoomIdentity, 300);
    window.setTimeout(() => fitRef.current(400), 900);
  }, [applyZoom]);

  const zoomBy = useCallback((factor: number) => {
    const svgElement = svgRef.current;
    const zoomBehavior = zoomRef.current;
    if (!svgElement || !zoomBehavior) {
      return;
    }
    d3.select(svgElement).transition().duration(200).call(zoomBehavior.scaleBy, factor);
  }, []);

  const clearFilters = useCallback(() => {
    setHideClean(false);
    setMinRisk(0);
    setSeverity("ALL");
    setHighlightOnly(false);
  }, []);

  const filtersActive = hideClean || minRisk > 0 || severity !== "ALL" || highlightActive;
  const hiddenCount = graphData.nodes.length - visibleNodes.length;
  const isEmpty = visibleNodes.filter((node) => !node.isRoot).length === 0 && graphData.nodes.length > 1;

  return (
    <section className="graph-panel">
      <div className="graph-toolbar">
        <div className="graph-filter-group">
          <Filter aria-hidden="true" />
          <label className="toggle-row">
            <input type="checkbox" checked={hideClean} onChange={(event) => setHideClean(event.currentTarget.checked)} />
            Hide clean
          </label>
          <label className="range-field">
            Risk {minRisk.toFixed(0)}+
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={minRisk}
              onChange={(event) => setMinRisk(Number(event.currentTarget.value))}
            />
          </label>
        </div>
        <select
          className="neo-select"
          aria-label="Filter by severity"
          value={severity}
          onChange={(event) => setSeverity(event.currentTarget.value as SeverityFilter)}
        >
          <option value="ALL">All severity</option>
          <option value="Clean">Clean</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>
        <button
          className={`neo-button ${highlightActive ? "primary" : ""}`}
          type="button"
          aria-pressed={highlightActive}
          title={selectedNode ? "Show only the selected package and everything it reaches" : "Select a package first"}
          onClick={() => setHighlightOnly((current) => !current)}
          disabled={!selectedNode}
        >
          Blast Radius
        </button>
        <button
          className="neo-button icon-button"
          type="button"
          aria-label="Reset graph layout"
          title="Reset layout, zoom and pinned nodes"
          onClick={resetLayout}
        >
          <RotateCcw aria-hidden="true" />
        </button>
      </div>

      {filtersActive ? (
        <div className="graph-status-bar">
          <span className="metric-label">
            Showing {visibleNodes.length} of {graphData.nodes.length} packages
            {hiddenCount > 0 ? ` · ${hiddenCount} hidden by filters` : ""}
          </span>
          <button className="graph-clear-filters" type="button" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : null}

      <div className="graph-canvas-wrap" ref={wrapRef}>
        <svg className="graph-svg" ref={svgRef} role="img" aria-label="Dependency risk graph" />

        <div className="graph-zoom-controls">
          <button className="neo-button icon-button" type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(1.4)}>
            <Plus aria-hidden="true" />
          </button>
          <button className="neo-button icon-button" type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(1 / 1.4)}>
            <Minus aria-hidden="true" />
          </button>
          <button
            className="neo-button icon-button"
            type="button"
            aria-label="Fit graph to view"
            title="Fit to view"
            onClick={() => fitRef.current(420)}
          >
            <Crosshair aria-hidden="true" />
          </button>
        </div>

        {isEmpty ? (
          <div className="graph-empty-state">
            <strong>No packages match these filters</strong>
            <p className="metric-label">Every dependency was filtered out. Loosen the risk threshold or clear the filters.</p>
            <button className="neo-button" type="button" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        ) : null}

        {visibleNodes.length > 50 ? <svg className="minimap" ref={minimapRef} aria-hidden="true" /> : null}

        {tooltip && tooltip.node.id !== selectedNodeId ? (
          <div
            className="graph-tooltip"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: `translate(${tooltip.flipX ? "-100%" : "0"}, ${tooltip.flipY ? "-100%" : "0"})`
            }}
          >
            <strong className="mono">{tooltip.node.name}</strong>
            <p className="metric-label">{tooltip.node.version ?? "version not pinned"}</p>
            <RiskBadge score={tooltip.node.riskScore} />
            {isLookupIncomplete(tooltip.node) ? <span className="badge lookup-warning">{tooltip.node.lookupStatus}</span> : null}
            <p className="metric-label">
              {tooltip.node.cveCount} CVEs · blast radius {tooltip.node.blastRadiusSize}
            </p>
          </div>
        ) : null}

        {selectedNode ? <NodeDetailPanel node={selectedNode} onClose={() => onSelectNode(null)} /> : null}
      </div>

      <p className="graph-hint metric-label">
        Drag a node to pin it · double-click to release · scroll or pinch to zoom · click empty space to deselect
      </p>
    </section>
  );
}

function NodeDetailPanel({ node, onClose }: { node: GraphNode; onClose: () => void }) {
  return (
    <aside className="detail-panel" aria-label={`${node.name} details`}>
      <div className="detail-header">
        <div>
          <h3 className="compact-title mono">{node.name}</h3>
          <p className="metric-label">{node.version ?? "version not pinned"}</p>
        </div>
        <button className="neo-button icon-button" type="button" aria-label="Close detail panel" title="Close" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="parse-summary" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 12 }}>
        <div className="metric-card">
          <p className="metric-value">{node.riskScore.toFixed(1)}</p>
          <p className="metric-label">{node.riskLabel}</p>
        </div>
        <div className="metric-card">
          <p className="metric-value">{node.blastRadiusSize}</p>
          <p className="metric-label">Blast Radius</p>
        </div>
      </div>

      <h4>CVEs</h4>
      <div className="cve-list">
        {node.cves.length === 0 ? (
          <div className="empty-panel">No CVEs found</div>
        ) : (
          node.cves.map((cve) => (
            <article className="cve-card" key={cve.id}>
              <div className="detail-header">
                <strong className="mono">{cve.id}</strong>
                <span className={`badge ${riskClass(cve.cvssScore)}`}>{cve.severity} {cve.cvssScore.toFixed(1)}</span>
              </div>
              <p>{cve.description}</p>
              {cve.cweIds.length > 0 ? <p className="metric-label">{cve.cweIds.join(", ")}</p> : null}
              <div className="link-list">
                {cve.references.slice(0, 4).map((reference, index) => {
                  let href = reference;
                  if (!href.startsWith("http")) {
                    if (href.startsWith("CVE-")) href = `https://nvd.nist.gov/vuln/detail/${href}`;
                    else if (href.startsWith("GHSA-")) href = `https://github.com/advisories/${href}`;
                    else href = `https://google.com/search?q=${encodeURIComponent(href)}`;
                  }
                  return (
                    <a className="mini-link" href={href} target="_blank" rel="noreferrer" key={reference}>
                      Ref {index + 1}
                    </a>
                  );
                })}
              </div>
            </article>
          ))
        )}
      </div>

      <h4>Blast Radius</h4>
      <div className="cve-list">
        {node.blastRadius.length === 0 ? (
          <div className="empty-panel">No downstream impact</div>
        ) : (
          node.blastRadius.map((entry) => (
            <div className="package-row" key={`${entry.packageId}:${entry.depth}`}>
              <span className="package-name">{entry.packageName}</span>
              <span className="badge">depth {entry.depth}</span>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function buildTooltip(event: PointerEvent, node: GraphNode, wrap: HTMLDivElement | null): TooltipState {
  const rect = wrap?.getBoundingClientRect();
  const x = rect ? event.clientX - rect.left : event.offsetX;
  const y = rect ? event.clientY - rect.top : event.offsetY;
  const width = rect?.width ?? 0;
  const height = rect?.height ?? 0;
  // Flip the card back over the cursor near an edge instead of letting it
  // spill outside the canvas.
  const flipX = width > 0 && x + TOOLTIP_WIDTH + 24 > width;
  const flipY = height > 0 && y + TOOLTIP_HEIGHT + 24 > height;
  return {
    x: x + (flipX ? -12 : 12),
    y: y + (flipY ? -12 : 12),
    flipX,
    flipY,
    node
  };
}

function neighbourhood(nodeId: string, links: SimLink[]): Set<string> {
  const ids = new Set<string>([nodeId]);
  for (const link of links) {
    if (asId(link.source) === nodeId) ids.add(asId(link.target));
    if (asId(link.target) === nodeId) ids.add(asId(link.source));
  }
  return ids;
}

function isBlastLink(link: SimLink, selectedId: string | null, blastIds: Set<string>): boolean {
  if (!selectedId) {
    return false;
  }
  const source = asId(link.source);
  const target = asId(link.target);
  const inRadius = (id: string) => id === selectedId || blastIds.has(id);
  return inRadius(source) && inRadius(target);
}

// Stops the line short of the target circle so the arrowhead lands on the rim
// instead of being swallowed by a large node.
function trimmed(link: SimLink, key: "x1" | "y1" | "x2" | "y2"): number {
  const source = endpoint(link.source);
  const target = endpoint(link.target);
  if (!source || !target || source.x == null || target.x == null) {
    return 0;
  }
  const dx = (target.x ?? 0) - (source.x ?? 0);
  const dy = (target.y ?? 0) - (source.y ?? 0);
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const sourceOffset = radiusForNode(source) + 2;
  const targetOffset = radiusForNode(target) + ARROW_LENGTH;
  switch (key) {
    case "x1":
      return (source.x ?? 0) + ux * sourceOffset;
    case "y1":
      return (source.y ?? 0) + uy * sourceOffset;
    case "x2":
      return (target.x ?? 0) - ux * targetOffset;
    default:
      return (target.y ?? 0) - uy * targetOffset;
  }
}

function radiusForNode(node: GraphNode): number {
  if (node.isRoot) {
    return 24;
  }
  return Math.max(8, Math.min(30, 8 + node.riskScore * 2.2));
}

function nodeColor(node: GraphNode): string {
  if (isLookupIncomplete(node)) {
    return "#6b7280";
  }
  return RISK_COLORS[riskClass(node.riskScore)];
}

function isLookupIncomplete(node: GraphNode): boolean {
  return node.lookupStatus === "failed" || node.lookupStatus === "unavailable";
}

function nodeAriaLabel(node: GraphNode): string {
  const version = node.version ? `version ${node.version}` : "version not pinned";
  const lookup = isLookupIncomplete(node) ? `, lookup ${node.lookupStatus}` : "";
  return `${node.name}, ${version}, ${node.riskLabel} risk ${node.riskScore.toFixed(1)}, ${node.cveCount} CVEs, blast radius ${node.blastRadiusSize}${lookup}. Activate to inspect.`;
}

function endpoint(value: string | SimNode): SimNode | undefined {
  return typeof value === "string" ? undefined : value;
}

function asId(value: string | SimNode): string {
  return typeof value === "string" ? value : value.id;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
