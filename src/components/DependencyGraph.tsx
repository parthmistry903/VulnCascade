"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Filter, RotateCcw, X } from "lucide-react";
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

export function DependencyGraph({ graphData, selectedNodeId, onSelectNode }: DependencyGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const minimapRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hideClean, setHideClean] = useState(false);
  const [minRisk, setMinRisk] = useState(0);
  const [severity, setSeverity] = useState<SeverityFilter>("ALL");
  const [highlightOnly, setHighlightOnly] = useState(false);
  const [layoutNonce, setLayoutNonce] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [size, setSize] = useState({ width: 900, height: 560 });

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

  const visibleNodes = useMemo(() => {
    return graphData.nodes.filter((node) => {
      if (node.isRoot) {
        return true;
      }
      if (highlightOnly && selectedNode && !blastRadiusIds.has(node.id)) {
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
  }, [blastRadiusIds, graphData.nodes, hideClean, highlightOnly, minRisk, selectedNode, severity]);

  const visibleEdges = useMemo(() => {
    const ids = new Set(visibleNodes.map((node) => node.id));
    return graphData.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
  }, [graphData.edges, visibleNodes]);

  useEffect(() => {
    if (selectedNodeId && !visibleNodes.some((node) => node.id === selectedNodeId)) {
      onSelectNode(null);
    }
  }, [onSelectNode, selectedNodeId, visibleNodes]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      setSize({
        width: Math.max(320, rect.width),
        height: Math.max(360, rect.height)
      });
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) {
      return;
    }

    const nodes: SimNode[] = visibleNodes.map((node) => ({ ...node }));
    const links: SimLink[] = visibleEdges.map((edge) => ({ ...edge }));
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const selectedRadiusIds = selectedNode ? new Set(selectedNode.blastRadius.map((entry) => entry.packageId)) : new Set<string>();
    const svg = d3.select(svgElement);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${size.width} ${size.height}`);

    const defs = svg.append("defs");
    defs.append("filter")
      .attr("id", "svg-glow")
      .attr("x", "-200%")
      .attr("y", "-200%")
      .attr("width", "500%")
      .attr("height", "500%")
      .append("feGaussianBlur")
      .attr("stdDeviation", "10")
      .attr("result", "blur");

    defs
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 21)
      .attr("refY", 0)
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#000000");

    const graphLayer = svg.append("g");
    const linkSelection = graphLayer
      .append("g")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(links)
      .join("line")
      .attr("stroke", "#000000")
      .attr("stroke-width", 2.5)
      .attr("marker-end", "url(#arrowhead)")
      .attr("opacity", 0.85);

    const nodeGroup = graphLayer
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes)
      .join("g")
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", nodeAriaLabel)
      .style("cursor", "grab")
      .on("click", (_event, node) => onSelectNode(node.id))
      .on("keydown", (event, node) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectNode(node.id);
        }
      })
      .on("dblclick", (_event, node) => {
        node.fx = null;
        node.fy = null;
      });

    nodeGroup.append("title").text(nodeAriaLabel);

    
    nodeGroup
      .append("circle")
      .attr("r", (node) => radiusForNode(node) + 5)
      .attr("fill", "none")
      .attr("stroke", (node) => {
        if (node.id === selectedNodeId) return "var(--accent-blue)";
        if (selectedRadiusIds.has(node.id)) return "var(--accent-yellow)";
        return "none";
      })
      .attr("stroke-width", 14) 
      .attr("opacity", 0.8)
      .style("filter", (node) => (node.id === selectedNodeId || selectedRadiusIds.has(node.id) ? "url(#svg-glow)" : "none"));

    
    nodeGroup
      .append("circle")
      .attr("r", (node) => radiusForNode(node))
      .attr("fill", nodeColor)
      .attr("stroke", "#000000")
      .attr("stroke-width", 3)
      .on("mouseenter", (event, node) => {
        setTooltip({
          x: event.offsetX + 12,
          y: event.offsetY + 12,
          node
        });
      })
      .on("mousemove", (event, node) => {
        setTooltip({
          x: event.offsetX + 12,
          y: event.offsetY + 12,
          node
        });
      })
      .on("mouseleave", () => setTooltip(null));

    nodeGroup
      .append("text")
      .text((node) => (node.name.length > 18 ? `${node.name.slice(0, 16)}...` : node.name))
      .attr("dy", (node) => radiusForNode(node) + 15)
      .attr("text-anchor", "middle")
      .attr("font-family", "DM Mono")
      .attr("font-size", 11)
      .attr("font-weight", 800)
      .attr("paint-order", "stroke")
      .attr("stroke", "#FFFFFF")
      .attr("stroke-width", 4)
      .attr("fill", "#000000");

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((node) => node.id)
          .distance((link) => (endpoint(link.source)?.isRoot ? 150 : 105))
          .strength(0.78)
      )
      .force("charge", d3.forceManyBody().strength(-430))
      .force("collide", d3.forceCollide<SimNode>().radius((node) => radiusForNode(node) + 24))
      .force("center", d3.forceCenter(selectedNodeId && size.width > 800 ? (size.width - 440) / 2 : size.width / 2, size.height / 2))
      .force("x", d3.forceX<SimNode>(selectedNodeId && size.width > 800 ? (size.width - 440) / 2 : size.width / 2).strength(0.045))
      .force("y", d3.forceY<SimNode>(size.height / 2).strength(0.045));

    const dragBehavior = d3
      .drag<SVGGElement, SimNode>()
      .on("start", (event, node) => {
        if (!event.active) {
          simulation.alphaTarget(0.3).restart();
        }
        node.fx = node.x;
        node.fy = node.y;
      })
      .on("drag", (event, node) => {
        node.fx = event.x;
        node.fy = event.y;
      })
      .on("end", (event, node) => {
        if (!event.active) {
          simulation.alphaTarget(0);
        }
        node.fx = event.x;
        node.fy = event.y;
      });

    nodeGroup.call(dragBehavior);

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        graphLayer.attr("transform", event.transform.toString());
      });
    svg.call(zoomBehavior);

    const minimap = d3.select(minimapRef.current);
    minimap.selectAll("*").remove();
    if (visibleNodes.length > 50) {
      minimap.attr("viewBox", "0 0 150 96");
      minimap.append("rect").attr("width", 150).attr("height", 96).attr("fill", "#FFFFFF");
      minimap
        .append("g")
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", 2.5)
        .attr("fill", nodeColor);
    }

    simulation.on("tick", () => {
      linkSelection
        .attr("x1", (link) => endpoint(link.source)?.x ?? 0)
        .attr("y1", (link) => endpoint(link.source)?.y ?? 0)
        .attr("x2", (link) => endpoint(link.target)?.x ?? 0)
        .attr("y2", (link) => endpoint(link.target)?.y ?? 0);

      nodeGroup.attr("transform", (node) => `translate(${node.x ?? 0},${node.y ?? 0})`);

      if (visibleNodes.length > 50) {
        minimap
          .selectAll<SVGCircleElement, SimNode>("circle")
          .attr("cx", (node) => clamp(((node.x ?? 0) / size.width) * 140 + 5, 5, 145))
          .attr("cy", (node) => clamp(((node.y ?? 0) / size.height) * 86 + 5, 5, 91));
      }
    });

    return () => {
      simulation.stop();
      svg.on(".zoom", null);
      setTooltip(null);
    };
  }, [graphData.nodes, layoutNonce, onSelectNode, selectedNode, selectedNodeId, size.height, size.width, visibleEdges, visibleNodes]);

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
        <select className="neo-select" value={severity} onChange={(event) => setSeverity(event.currentTarget.value as SeverityFilter)}>
          <option value="ALL">All severity</option>
          <option value="Clean">Clean</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>
        <button className="neo-button" type="button" onClick={() => setHighlightOnly((current) => !current)} disabled={!selectedNode}>
          Blast Radius
        </button>
        <button className="neo-button icon-button" type="button" aria-label="Reset graph layout" title="Reset layout" onClick={() => setLayoutNonce((value) => value + 1)}>
          <RotateCcw aria-hidden="true" />
        </button>
      </div>
      <div className="graph-canvas-wrap" ref={wrapRef}>
        <svg className="graph-svg" ref={svgRef} role="img" aria-label="Dependency risk graph" />
        {visibleNodes.length > 50 ? <svg className="minimap" ref={minimapRef} aria-label="Graph minimap" /> : null}
        {tooltip && tooltip.node.id !== selectedNodeId ? (
          <div className="graph-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
