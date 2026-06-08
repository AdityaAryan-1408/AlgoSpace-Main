'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import {
  MousePointer,
  Square,
  Circle as CircleIcon,
  Database,
  ArrowRight,
  Trash2,
  Undo2,
  Redo2,
  Type,
  Plus,
  RefreshCw,
  Zap,
  Loader2,
  Move,
  ZoomIn,
  ZoomOut,
  Columns
} from "lucide-react";

export interface CanvasNode {
  id: string;
  type: "service" | "client" | "database" | "router" | "text" | "class";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  attributes?: string;
  isAbstract?: boolean;
}

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  panOffset?: { x: number; y: number };
  zoom?: number;
}

interface SystemDesignCanvasProps {
  value?: string; // Serialized JSON string of CanvasData
  onChange: (value: string) => void;
  readOnly?: boolean;
}

const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_CANVAS_HEIGHT = 500;

export function SystemDesignCanvas({
  value,
  onChange,
  readOnly = false
}: SystemDesignCanvasProps) {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [mode, setMode] = useState<"select" | "connect" | "service" | "client" | "database" | "router" | "text" | "class">("select");
  
  // Connection drag state
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);

  // Editing state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [editInputValue, setEditInputValue] = useState("");
  const [editClassAttributes, setEditClassAttributes] = useState("");
  const [editClassIsAbstract, setEditClassIsAbstract] = useState(false);

  // Undo / Redo stacks
  const [undoStack, setUndoStack] = useState<CanvasData[]>([]);
  const [redoStack, setRedoStack] = useState<CanvasData[]>([]);

  const svgRef = useRef<SVGSVGElement>(null);
  const isDraggingNode = useRef<string | null>(null);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const isResizingNode = useRef<string | null>(null);
  const isRotatingNode = useRef<string | null>(null);
  const dragStartDimensions = useRef({ width: 0, height: 0, x: 0, y: 0 });
  const dragStartAngle = useRef<number>(0);

  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  const getLocalCoords = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current ? svgRef.current.getBoundingClientRect() : { left: 0, top: 0 };
    return {
      x: (clientX - rect.left - panOffset.x) / zoom,
      y: (clientY - rect.top - panOffset.y) / zoom
    };
  }, [panOffset, zoom]);

  // Load initial value
  useEffect(() => {
    if (value) {
      try {
        const parsed = JSON.parse(value) as CanvasData;
        if (parsed.nodes && parsed.edges) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges);
          if (parsed.panOffset) {
            setPanOffset(parsed.panOffset);
          }
          if (parsed.zoom) {
            setZoom(parsed.zoom);
          }
        }
      } catch {
        // invalid JSON or empty
      }
    }
  }, [value]);

  // Dispatch change and save state
  const saveState = useCallback((newNodes: CanvasNode[], newEdges: CanvasEdge[], pushToUndo = true, customPan = panOffset, customZoom = zoom) => {
    const data: CanvasData = { nodes: newNodes, edges: newEdges, panOffset: customPan, zoom: customZoom };
    
    if (pushToUndo) {
      setUndoStack((prev) => [...prev, { nodes, edges, panOffset, zoom }]);
      setRedoStack([]); // Clear redo
    }

    setNodes(newNodes);
    setEdges(newEdges);
    onChange(JSON.stringify(data));
  }, [nodes, edges, panOffset, zoom, onChange]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, { nodes, edges, panOffset, zoom }]);
    if (previous.panOffset) setPanOffset(previous.panOffset);
    if (previous.zoom) setZoom(previous.zoom);
    saveState(previous.nodes, previous.edges, false, previous.panOffset, previous.zoom || 1);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, { nodes, edges, panOffset, zoom }]);
    if (next.panOffset) setPanOffset(next.panOffset);
    if (next.zoom) setZoom(next.zoom);
    saveState(next.nodes, next.edges, false, next.panOffset, next.zoom || 1);
  };

  const handleZoomButton = (zoomIn: boolean) => {
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;

    const lx = (mx - panOffset.x) / zoom;
    const ly = (my - panOffset.y) / zoom;

    const zoomFactor = 1.15;
    let nextZoom = zoom;
    if (zoomIn) {
      nextZoom = Math.min(2, zoom * zoomFactor);
    } else {
      nextZoom = Math.max(0.5, zoom / zoomFactor);
    }

    const newPanX = mx - lx * nextZoom;
    const newPanY = my - ly * nextZoom;

    setZoom(nextZoom);
    setPanOffset({ x: newPanX, y: newPanY });
    saveState(nodes, edges, false, { x: newPanX, y: newPanY }, nextZoom);
  };

  const handleClear = () => {
    if (nodes.length === 0 && edges.length === 0) return;
    if (confirm("Are you sure you want to clear the entire canvas diagram?")) {
      saveState([], []);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  };

  // Add a shape to the canvas
  const addShape = (type: CanvasNode["type"], x: number, y: number) => {
    const id = `node-${Date.now()}`;
    let label = "New Shape";
    let width = 140;
    let height = 60;
    let extraFields: Partial<CanvasNode> = {};

    switch (type) {
      case "service":
        label = "Service";
        width = 140;
        height = 60;
        break;
      case "client":
        label = "Client App";
        width = 110;
        height = 50;
        break;
      case "database":
        label = "Database";
        width = 120;
        height = 85;
        break;
      case "router":
        label = "Router";
        width = 110;
        height = 50;
        break;
      case "text":
        label = "Label text";
        width = 140;
        height = 40;
        break;
      case "class":
        label = "User";
        width = 150;
        height = 110;
        extraFields = {
          attributes: "- id: int\n- name: string\n+ getName(): string",
          isAbstract: false
        };
        break;
    }

    const newNode: CanvasNode = {
      id,
      type,
      label,
      x: Math.round(x / 10) * 10,
      y: Math.round(y / 10) * 10,
      width,
      height,
      ...extraFields
    };

    saveState([...nodes, newNode], edges);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    setMode("select");

    // Immediately edit label
    setEditingNodeId(id);
    setEditInputValue(label);
    if (type === "class") {
      setEditClassAttributes(extraFields.attributes || "");
      setEditClassIsAbstract(extraFields.isAbstract || false);
    }
  };

  // SVG click handling (create shape or deselect)
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const svg = svgRef.current;
    if (!svg) return;

    const coords = getLocalCoords(e.clientX, e.clientY);
    const x = coords.x;
    const y = coords.y;

    if (mode !== "select" && mode !== "connect") {
      addShape(mode, x, y);
    } else {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setEditingNodeId(null);
      setEditingEdgeId(null);
    }
  };

  // Delete selected node or edge
  const handleDeleteSelected = useCallback(() => {
    if (readOnly) return;
    if (selectedNodeId) {
      const filteredNodes = nodes.filter((n) => n.id !== selectedNodeId);
      // Also delete connected edges
      const filteredEdges = edges.filter((e) => e.from !== selectedNodeId && e.to !== selectedNodeId);
      saveState(filteredNodes, filteredEdges);
      setSelectedNodeId(null);
    } else if (selectedEdgeId) {
      const filteredEdges = edges.filter((e) => e.id !== selectedEdgeId);
      saveState(nodes, filteredEdges);
      setSelectedEdgeId(null);
    }
  }, [nodes, edges, selectedNodeId, selectedEdgeId, saveState, readOnly]);

  // Keypress listener for delete key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const activeEl = document.activeElement;
        const isInput = activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA" || activeEl?.getAttribute("contenteditable") === "true";
        if (!isInput) {
          handleDeleteSelected();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDeleteSelected]);

  // Pointer drag triggers
  const handleNodePointerDown = (e: React.PointerEvent, nodeId: string) => {
    if (readOnly) return;
    e.stopPropagation();
    
    if (mode === "connect") {
      setConnectSourceId(nodeId);
      return;
    }

    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    isDraggingNode.current = nodeId;

    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      const coords = getLocalCoords(e.clientX, e.clientY);
      dragStartOffset.current = {
        x: coords.x - node.x,
        y: coords.y - node.y
      };
    }
  };

  const handleResizePointerDown = (e: React.PointerEvent, nodeId: string) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    isResizingNode.current = nodeId;
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      dragStartDimensions.current = {
        width: node.width,
        height: node.height,
        x: e.clientX,
        y: e.clientY
      };
    }
  };

  const handleRotatePointerDown = (e: React.PointerEvent, nodeId: string) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    isRotatingNode.current = nodeId;
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;
      const coords = getLocalCoords(e.clientX, e.clientY);
      const mx = coords.x - cx;
      const my = coords.y - cy;
      const currentAngle = node.rotation || 0;
      dragStartAngle.current = Math.atan2(my, mx) * (180 / Math.PI) - currentAngle;
    }
  };

  const handleSvgPointerMove = (e: React.PointerEvent) => {
    if (readOnly) return;

    if (isResizingNode.current) {
      e.preventDefault();
      const nodeId = isResizingNode.current;
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        const dx = e.clientX - dragStartDimensions.current.x;
        const dy = e.clientY - dragStartDimensions.current.y;
        const startW = dragStartDimensions.current.width;
        const startH = dragStartDimensions.current.height;
        const rotation = node.rotation || 0;
        const rad = -rotation * Math.PI / 180;
        
        // Scale delta by zoom
        const localDx = (dx * Math.cos(rad) - dy * Math.sin(rad)) / zoom;
        const localDy = (dx * Math.sin(rad) + dy * Math.cos(rad)) / zoom;

        // Snap resizing to 10px, minimum 60x40
        const nextWidth = Math.max(60, Math.round((startW + localDx) / 10) * 10);
        const nextHeight = Math.max(40, Math.round((startH + localDy) / 10) * 10);

        setNodes(nodes.map((n) => n.id === nodeId ? { ...n, width: nextWidth, height: nextHeight } : n));
      }
      return;
    }

    if (isPanning.current) {
      e.preventDefault();
      const newPanX = e.clientX - panStart.current.x;
      const newPanY = e.clientY - panStart.current.y;
      setPanOffset({ x: newPanX, y: newPanY });
      return;
    }

    if (isRotatingNode.current) {
      e.preventDefault();
      const nodeId = isRotatingNode.current;
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        const cx = node.x + node.width / 2;
        const cy = node.y + node.height / 2;
        const coords = getLocalCoords(e.clientX, e.clientY);
        const mx = coords.x - cx;
        const my = coords.y - cy;
        const angle = Math.atan2(my, mx) * (180 / Math.PI);
        let nextRotation = Math.round(angle - dragStartAngle.current);
        
        // Snap to 15 degrees if Shift is pressed
        if (e.shiftKey) {
          nextRotation = Math.round(nextRotation / 15) * 15;
        }

        setNodes(nodes.map((n) => n.id === nodeId ? { ...n, rotation: nextRotation } : n));
      }
      return;
    }

    if (isDraggingNode.current) {
      e.preventDefault();
      const nodeId = isDraggingNode.current;
      const coords = getLocalCoords(e.clientX, e.clientY);

      // Snap coordinates to 10px and drag freely without layout box bounding limits (infinite canvas)
      const nextX = Math.round((coords.x - dragStartOffset.current.x) / 10) * 10;
      const nextY = Math.round((coords.y - dragStartOffset.current.y) / 10) * 10;

      setNodes(nodes.map((n) => n.id === nodeId ? { ...n, x: nextX, y: nextY } : n));
    }
  };

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const isBackground = e.target === e.currentTarget || (e.target as SVGElement)?.tagName === "rect" && (e.target as SVGElement).getAttribute("fill")?.includes("dot-grid");
    
    if (mode === "select" && isBackground) {
      isPanning.current = true;
      panStart.current = {
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    if (isPanning.current) {
      isPanning.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
      saveState(nodes, edges, false, panOffset, zoom);
      return;
    }
    if (isDraggingNode.current || isResizingNode.current || isRotatingNode.current) {
      isDraggingNode.current = null;
      isResizingNode.current = null;
      isRotatingNode.current = null;
      saveState(nodes, edges, true); // Save the finalized state
    }
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (e: WheelEvent) => {
      // Prevent default page scrolling when inside the grid
      e.preventDefault();

      if (e.ctrlKey) {
        const rect = svg.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Find local coordinates under the mouse before zooming
        const lx = (mx - panOffset.x) / zoom;
        const ly = (my - panOffset.y) / zoom;

        const zoomFactor = 1.05;
        let nextZoom = zoom;
        if (e.deltaY < 0) {
          nextZoom = Math.min(2.5, zoom * zoomFactor);
        } else {
          nextZoom = Math.max(0.4, zoom / zoomFactor);
        }

        // Calculate new panOffset so that (lx, ly) maps to the same (mx, my) under nextZoom
        const newPanX = mx - lx * nextZoom;
        const newPanY = my - ly * nextZoom;

        setZoom(nextZoom);
        setPanOffset({ x: newPanX, y: newPanY });
        saveState(nodes, edges, false, { x: newPanX, y: newPanY }, nextZoom);
      } else {
        // Pan grid in direction of wheel scroll
        const nextPanX = panOffset.x - e.deltaX;
        const nextPanY = panOffset.y - e.deltaY;
        setPanOffset({ x: nextPanX, y: nextPanY });
        saveState(nodes, edges, false, { x: nextPanX, y: nextPanY }, zoom);
      }
    };

    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      svg.removeEventListener("wheel", onWheel);
    };
  }, [panOffset, zoom, nodes, edges, saveState]);

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (mode === "connect") {
      if (connectSourceId && connectSourceId !== nodeId) {
        // Create edge
        const edgeId = `edge-${Date.now()}`;
        const newEdge: CanvasEdge = {
          id: edgeId,
          from: connectSourceId,
          to: nodeId,
          label: "Connection"
        };
        saveState(nodes, [...edges, newEdge]);
        setSelectedEdgeId(edgeId);
        setSelectedNodeId(null);
        setConnectSourceId(null);
        setMode("select");
      } else {
        setConnectSourceId(nodeId);
      }
    } else {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
    }
  };

  const handleNodeDoubleClick = (e: React.MouseEvent, nodeId: string) => {
    if (readOnly) return;
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      setEditingNodeId(nodeId);
      setEditInputValue(node.label);
      if (node.type === "class") {
        setEditClassAttributes(node.attributes || "");
        setEditClassIsAbstract(node.isAbstract || false);
      }
    }
  };

  const handleEdgeClick = (e: React.MouseEvent, edgeId: string) => {
    e.stopPropagation();
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
  };

  const handleEdgeDoubleClick = (e: React.MouseEvent, edgeId: string) => {
    if (readOnly) return;
    e.stopPropagation();
    const edge = edges.find((ed) => ed.id === edgeId);
    if (edge) {
      setEditingEdgeId(edgeId);
      setEditInputValue(edge.label);
    }
  };

  // Label Edit Submits
  const handleEditSubmit = () => {
    if (editingNodeId) {
      saveState(
        nodes.map((n) => {
          if (n.id === editingNodeId) {
            if (n.type === "class") {
              return {
                ...n,
                label: editInputValue.trim(),
                attributes: editClassAttributes,
                isAbstract: editClassIsAbstract
              };
            }
            return { ...n, label: editInputValue.trim() };
          }
          return n;
        }),
        edges
      );
      setEditingNodeId(null);
    } else if (editingEdgeId) {
      saveState(nodes, edges.map((e) => e.id === editingEdgeId ? { ...e, label: editInputValue.trim() } : e));
      setEditingEdgeId(null);
    }
  };

  // Helper to draw connecting line with back-offs so arrow sits at shape borders
  const getLinePoints = (n1: CanvasNode, n2: CanvasNode) => {
    const cx1 = n1.x + n1.width / 2;
    const cy1 = n1.y + n1.height / 2;
    const cx2 = n2.x + n2.width / 2;
    const cy2 = n2.y + n2.height / 2;

    const dx = cx2 - cx1;
    const dy = cy2 - cy1;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len === 0) return { x1: cx1, y1: cy1, x2: cx2, y2: cy2 };

    // Back off factors based on shape dimensions
    const backOffSource = Math.min(n1.width, n1.height) / 2 + 5;
    const backOffTarget = Math.min(n2.width, n2.height) / 2 + 10;

    return {
      x1: cx1 + (dx / len) * backOffSource,
      y1: cy1 + (dy / len) * backOffSource,
      x2: cx2 - (dx / len) * backOffTarget,
      y2: cy2 - (dy / len) * backOffTarget
    };
  };

  // Predefined Shape renderers
  const renderShape = (node: CanvasNode) => {
    const isSelected = selectedNodeId === node.id;
    const strokeColor = isSelected ? "#3b82f6" : "#64748b";
    const strokeWidth = isSelected ? 2.5 : 1.5;

    switch (node.type) {
      case "client":
        return (
          <g>
            <ellipse
              cx={node.x + node.width / 2}
              cy={node.y + node.height / 2}
              rx={node.width / 2}
              ry={node.height / 2}
              fill="rgba(99, 102, 241, 0.12)"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            {/* Display screen lines for Client App feel */}
            <path 
              d={`M ${node.x + 15} ${node.y + node.height - 8} L ${node.x + node.width - 15} ${node.y + node.height - 8}`} 
              stroke={strokeColor} 
              strokeWidth={1} 
              strokeDasharray="2,2" 
            />
          </g>
        );

      case "database":
        const topH = 12;
        return (
          <g>
            {/* Cylinder Bottom Half */}
            <path
              d={`M ${node.x} ${node.y + topH} 
                  V ${node.y + node.height - topH} 
                  A ${node.width / 2} ${topH} 0 0 0 ${node.x + node.width} ${node.y + node.height - topH} 
                  V ${node.y + topH} 
                  A ${node.width / 2} ${topH} 0 0 1 ${node.x} ${node.y + topH}`}
              fill="rgba(34, 197, 94, 0.12)"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            {/* Cylinder Top Ellipse */}
            <ellipse
              cx={node.x + node.width / 2}
              cy={node.y + topH}
              rx={node.width / 2}
              ry={topH}
              fill="rgba(34, 197, 94, 0.15)"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            {/* Stack stripes for visual db appearance */}
            <path 
              d={`M ${node.x} ${node.y + node.height/2 - 4} A ${node.width/2} ${topH} 0 0 0 ${node.x + node.width} ${node.y + node.height/2 - 4}`} 
              fill="none" 
              stroke={strokeColor} 
              strokeWidth={1} 
              strokeDasharray="3,3" 
            />
            <path 
              d={`M ${node.x} ${node.y + node.height/2 + 8} A ${node.width/2} ${topH} 0 0 0 ${node.x + node.width} ${node.y + node.height/2 + 8}`} 
              fill="none" 
              stroke={strokeColor} 
              strokeWidth={1} 
              strokeDasharray="3,3" 
            />
          </g>
        );

      case "router":
        const halfW = node.width / 2;
        const halfH = node.height / 2;
        return (
          <polygon
            points={`${node.x + halfW},${node.y} 
                     ${node.x + node.width},${node.y + halfH} 
                     ${node.x + halfW},${node.y + node.height} 
                     ${node.x},${node.y + halfH}`}
            fill="rgba(234, 179, 8, 0.12)"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );

      case "class":
        const isAbs = node.isAbstract === true;
        const cLines = node.attributes ? node.attributes.split("\n") : [];
        const headerH = isAbs ? 32 : 24;
        
        return (
          <g>
            <rect
              x={node.x}
              y={node.y}
              width={node.width}
              height={node.height}
              rx="4"
              fill="rgba(168, 85, 247, 0.08)"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            {/* Class name header */}
            {isAbs && (
              <text
                x={node.x + node.width / 2}
                y={node.y + 12}
                fill="#a855f7"
                fontSize="8"
                fontWeight="semibold"
                fontFamily="monospace"
                textAnchor="middle"
                pointerEvents="none"
              >
                &lt;&lt;abstract&gt;&gt;
              </text>
            )}
            <text
              x={node.x + node.width / 2}
              y={node.y + (isAbs ? 26 : 16)}
              fill="#f8fafc"
              fontSize="11"
              fontWeight="bold"
              fontStyle={isAbs ? "italic" : "normal"}
              fontFamily="monospace"
              textAnchor="middle"
              pointerEvents="none"
            >
              {node.label}
            </text>
            
            <line
              x1={node.x}
              y1={node.y + headerH}
              x2={node.x + node.width}
              y2={node.y + headerH}
              stroke={strokeColor}
              strokeWidth={1}
            />
            
            {/* Attribute lines */}
            {cLines.map((line, idx) => {
              const lineY = node.y + headerH + 12 + idx * 14;
              if (lineY > node.y + node.height - 4) return null; // clip
              return (
                <text
                  key={idx}
                  x={node.x + 8}
                  y={lineY}
                  fill="#94a3b8"
                  fontSize="9.5"
                  fontFamily="monospace"
                  textAnchor="start"
                  pointerEvents="none"
                >
                  {line}
                </text>
              );
            })}
          </g>
        );

      case "text":
        return (
          <rect
            x={node.x}
            y={node.y}
            width={node.width}
            height={node.height}
            fill="transparent"
            stroke={isSelected ? "#3b82f6" : "rgba(255,255,255,0.06)"}
            strokeWidth={1}
            strokeDasharray={isSelected ? undefined : "3,3"}
            rx="4"
          />
        );

      case "service":
      default:
        return (
          <rect
            x={node.x}
            y={node.y}
            width={node.width}
            height={node.height}
            rx="8"
            fill="rgba(6, 182, 212, 0.12)"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );
    }
  };

  const editingNode = nodes.find((n) => n.id === editingNodeId);
  const isEditingClass = editingNode?.type === "class";

  return (
    <div className="flex flex-col gap-3 h-full select-none">
      {/* Visual Canvas Tools Header */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/20 border border-border/80 p-2 rounded-xl shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Modes */}
            <Button
              size="sm"
              variant={mode === "select" ? "secondary" : "ghost"}
              onClick={() => { setMode("select"); setConnectSourceId(null); }}
              className="h-8 px-2 text-xs gap-1"
              title="Select / Move Elements"
            >
              <MousePointer className="w-3.5 h-3.5" />
              Pointer
            </Button>
            <Button
              size="sm"
              variant={mode === "connect" ? "secondary" : "ghost"}
              onClick={() => { setMode("connect"); setConnectSourceId(null); }}
              className="h-8 px-2 text-xs gap-1 text-slate-400"
              title="Draw Directional Line"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Connect
            </Button>

            <div className="w-px h-5 bg-border mx-1" />

            {/* Shape insertions */}
            <Button
              size="sm"
              variant={mode === "client" ? "secondary" : "ghost"}
              onClick={() => setMode("client")}
              className="h-8 px-2 text-xs gap-1 text-indigo-400"
              title="Add User/Client App Node"
            >
              <CircleIcon className="w-3.5 h-3.5" />
              Client
            </Button>
            <Button
              size="sm"
              variant={mode === "service" ? "secondary" : "ghost"}
              onClick={() => setMode("service")}
              className="h-8 px-2 text-xs gap-1 text-cyan-400"
              title="Add Service/API Box"
            >
              <Square className="w-3.5 h-3.5" />
              Service
            </Button>
            <Button
              size="sm"
              variant={mode === "class" ? "secondary" : "ghost"}
              onClick={() => setMode("class")}
              className="h-8 px-2 text-xs gap-1 text-purple-400"
              title="Add UML Class Box"
            >
              <Columns className="w-3.5 h-3.5" />
              Class
            </Button>
            <Button
              size="sm"
              variant={mode === "database" ? "secondary" : "ghost"}
              onClick={() => setMode("database")}
              className="h-8 px-2 text-xs gap-1 text-emerald-400"
              title="Add DB Cylinder Node"
            >
              <Database className="w-3.5 h-3.5" />
              Database
            </Button>
            <Button
              size="sm"
              variant={mode === "router" ? "secondary" : "ghost"}
              onClick={() => setMode("router")}
              className="h-8 px-2 text-xs gap-1 text-yellow-400"
              title="Add Decision/Router Diamond"
            >
              <Zap className="w-3.5 h-3.5" />
              Decision
            </Button>
            <Button
              size="sm"
              variant={mode === "text" ? "secondary" : "ghost"}
              onClick={() => setMode("text")}
              className="h-8 px-2 text-xs gap-1 text-slate-400"
              title="Add Text Label Shape"
            >
              <Type className="w-3.5 h-3.5" />
              Text
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              disabled={undoStack.length === 0}
              onClick={handleUndo}
              className="w-8 h-8 rounded-lg disabled:opacity-30"
              title="Undo Shape Change"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={redoStack.length === 0}
              onClick={handleRedo}
              className="w-8 h-8 rounded-lg disabled:opacity-30"
              title="Redo Shape Change"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={!selectedNodeId && !selectedEdgeId}
              onClick={handleDeleteSelected}
              className="w-8 h-8 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-500/10 disabled:opacity-30"
              title="Delete Selected Shape (Del)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={nodes.length === 0 && edges.length === 0}
              onClick={handleClear}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-400"
              title="Clear Canvas Diagram"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={panOffset.x === 0 && panOffset.y === 0 && zoom === 1}
              onClick={() => {
                setPanOffset({ x: 0, y: 0 });
                setZoom(1);
                saveState(nodes, edges, false, { x: 0, y: 0 }, 1);
              }}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-cyan-400 disabled:opacity-30"
              title="Reset View Position & Zoom"
            >
              <Move className="w-3.5 h-3.5" />
            </Button>
            <div className="w-px h-5 bg-border mx-1" />
            <Button
              size="icon"
              variant="ghost"
              disabled={zoom <= 0.5}
              onClick={() => handleZoomButton(false)}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-cyan-400 disabled:opacity-30"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <span className="text-[10px] text-slate-400 font-bold min-w-[36px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              size="icon"
              variant="ghost"
              disabled={zoom >= 2}
              onClick={() => handleZoomButton(true)}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-cyan-400 disabled:opacity-30"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* SVG Canvas Board */}
      <div 
        className="relative flex-1 bg-[#151525] border border-border/80 rounded-2xl overflow-hidden shadow-inner min-h-[300px] h-full"
        style={{ cursor: mode === "select" ? "default" : mode === "connect" ? "cell" : "copy" }}
      >
        <svg
          ref={svgRef}
          className="w-full h-full min-h-[400px]"
          onClick={handleSvgClick}
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          style={{ touchAction: "none" }}
        >
          <defs>
            {/* Grid Pattern */}
            <pattern 
              id="dot-grid" 
              width="20" 
              height="20" 
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}
            >
              <circle cx="2" cy="2" r="1.2" fill="rgba(255, 255, 255, 0.08)" />
            </pattern>
            {/* Arrowhead Marker */}
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="7"
              refY="3.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0 0, 8 3.5, 0 7" fill="#64748b" />
            </marker>
            <marker
              id="arrowhead-selected"
              markerWidth="10"
              markerHeight="7"
              refX="7"
              refY="3.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0 0, 8 3.5, 0 7" fill="#3b82f6" />
            </marker>
          </defs>

          {/* Grid Fill */}
          <rect width="100%" height="100%" fill="url(#dot-grid)" />

          {/* Viewport Translated Group for panning & zoom */}
          <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>

          {/* Draw connecting lines (Edges) */}
          {edges.map((edge) => {
            const fromNode = nodes.find((n) => n.id === edge.from);
            const toNode = nodes.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const pts = getLinePoints(fromNode, toNode);
            const isSelected = selectedEdgeId === edge.id;
            
            // Middle point for edge label
            const midX = (pts.x1 + pts.x2) / 2;
            const midY = (pts.y1 + pts.y2) / 2;

            return (
              <g key={edge.id} className="group cursor-pointer">
                {/* Thick invisible interaction line to make clicking easy */}
                <line
                  x1={pts.x1}
                  y1={pts.y1}
                  x2={pts.x2}
                  y2={pts.y2}
                  stroke="transparent"
                  strokeWidth="12"
                  onClick={(e) => handleEdgeClick(e, edge.id)}
                  onDoubleClick={(e) => handleEdgeDoubleClick(e, edge.id)}
                />
                <line
                  x1={pts.x1}
                  y1={pts.y1}
                  x2={pts.x2}
                  y2={pts.y2}
                  stroke={isSelected ? "#3b82f6" : "#64748b"}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  markerEnd={`url(#${isSelected ? "arrowhead-selected" : "arrowhead"})`}
                  onClick={(e) => handleEdgeClick(e, edge.id)}
                  onDoubleClick={(e) => handleEdgeDoubleClick(e, edge.id)}
                  className="transition-colors"
                />

                {/* Connection label */}
                {edge.label && (
                  <g 
                    onClick={(e) => handleEdgeClick(e, edge.id)}
                    onDoubleClick={(e) => handleEdgeDoubleClick(e, edge.id)}
                  >
                    <rect
                      x={midX - (edge.label.length * 3.5) - 6}
                      y={midY - 10}
                      width={(edge.label.length * 7) + 12}
                      height="20"
                      rx="4"
                      fill="#1e1e2f"
                      stroke={isSelected ? "#3b82f6" : "rgba(255,255,255,0.06)"}
                      strokeWidth="1"
                    />
                    <text
                      x={midX}
                      y={midY + 4}
                      fill={isSelected ? "#60a5fa" : "#94a3b8"}
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Draw shape nodes */}
          {nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const textY = node.type === "database" 
              ? node.y + node.height / 2 + 6 
              : node.y + node.height / 2 + 5;
            const cx = node.x + node.width / 2;
            const cy = node.y + node.height / 2;
            const rotation = node.rotation || 0;

            return (
              <g
                key={node.id}
                onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                onClick={(e) => handleNodeClick(e, node.id)}
                onDoubleClick={(e) => handleNodeDoubleClick(e, node.id)}
                className={`group cursor-grab ${isDraggingNode.current === node.id ? "cursor-grabbing" : ""}`}
                transform={rotation ? `rotate(${rotation}, ${cx}, ${cy})` : undefined}
              >
                {/* SVG Visual Shape */}
                {renderShape(node)}

                {/* Shape Label */}
                {node.type !== "class" && (
                  <text
                    x={node.x + node.width / 2}
                    y={textY}
                    fill={node.type === "text" ? "#94a3b8" : "#f8fafc"}
                    fontSize="11"
                    fontWeight={node.type === "text" ? "normal" : "semibold"}
                    fontFamily={node.type === "text" ? "sans-serif" : "monospace"}
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    {node.label}
                  </text>
                )}

                {/* Selection outline and resize/rotate handles */}
                {isSelected && !readOnly && (
                  <g>
                    {/* Bounding outline */}
                    <rect
                      x={node.x - 4}
                      y={node.y - 4}
                      width={node.width + 8}
                      height={node.height + 8}
                      rx={4}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={1}
                      strokeDasharray="4,4"
                      pointerEvents="none"
                    />
                    {/* Resize handle */}
                    <rect
                      x={node.x + node.width - 6}
                      y={node.y + node.height - 6}
                      width={12}
                      height={12}
                      rx={3}
                      fill="#ffffff"
                      stroke="#3b82f6"
                      strokeWidth={1.5}
                      style={{ cursor: "se-resize" }}
                      onPointerDown={(e) => handleResizePointerDown(e, node.id)}
                    />
                    {/* Rotation handle */}
                    <line
                      x1={node.x + node.width / 2}
                      y1={node.y}
                      x2={node.x + node.width / 2}
                      y2={node.y - 20}
                      stroke="#3b82f6"
                      strokeWidth={1}
                      strokeDasharray="2,2"
                    />
                    <circle
                      cx={node.x + node.width / 2}
                      cy={node.y - 20}
                      r={5}
                      fill="#ffffff"
                      stroke="#3b82f6"
                      strokeWidth={1.5}
                      style={{ cursor: "crosshair" }}
                      onPointerDown={(e) => handleRotatePointerDown(e, node.id)}
                    />
                  </g>
                )}

                {/* Target connect pointer overlay */}
                {mode === "connect" && connectSourceId === node.id && (
                  <circle
                    cx={node.x + node.width / 2}
                    cy={node.y + node.height / 2}
                    r={Math.min(node.width, node.height) / 2 + 8}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.5"
                    strokeDasharray="4,3"
                    className="animate-spin"
                    style={{ animationDuration: "8s" }}
                  />
                )}
              </g>
            );
          })}
          </g>
        </svg>

        {/* Inline Label Editing Inputs */}
        {(editingNodeId || editingEdgeId) && (
          <div 
            className="absolute bg-card border border-border p-3 rounded-xl shadow-2xl flex flex-col gap-2.5 z-30 w-64 animate-in zoom-in-95 duration-100"
            style={(() => {
              const containerWidth = svgRef.current?.clientWidth || DEFAULT_CANVAS_WIDTH;
              const containerHeight = svgRef.current?.clientHeight || DEFAULT_CANVAS_HEIGHT;
              if (editingNodeId) {
                const node = nodes.find(n => n.id === editingNodeId);
                if (node) {
                  const isClass = node.type === "class";
                  const popupHeight = isClass ? 260 : 100;
                  return {
                    left: `${Math.max(10, Math.min(containerWidth - 270, (node.x * zoom) + panOffset.x))}px`,
                    top: `${Math.max(10, Math.min(containerHeight - popupHeight, ((node.y + node.height) * zoom) + panOffset.y + 8))}px`
                  };
                }
              } else if (editingEdgeId) {
                const edge = edges.find(ed => ed.id === editingEdgeId);
                const fromNode = nodes.find(n => n?.id === edge?.from);
                const toNode = nodes.find(n => n?.id === edge?.to);
                if (fromNode && toNode) {
                  const midX = (fromNode.x + fromNode.width/2 + toNode.x + toNode.width/2) / 2;
                  const midY = (fromNode.y + fromNode.height/2 + toNode.y + toNode.height/2) / 2;
                  return {
                    left: `${Math.max(10, Math.min(containerWidth - 270, (midX * zoom) + panOffset.x - 128))}px`,
                    top: `${Math.max(10, Math.min(containerHeight - 120, (midY * zoom) + panOffset.y + 16))}px`
                  };
                }
              }
              return { left: "10px", top: "10px" };
            })()}
          >
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block text-left">
              {editingNodeId 
                ? (isEditingClass ? "Edit UML Class" : "Edit Component Label") 
                : "Edit Connection Label"}
            </span>

            {isEditingClass ? (
              <div className="flex flex-col gap-2.5 text-left">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-muted-foreground font-bold uppercase">Class Name</label>
                  <input
                    type="text"
                    autoFocus
                    value={editInputValue}
                    onChange={(e) => setEditInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) handleEditSubmit();
                      if (e.key === "Escape") { setEditingNodeId(null); }
                    }}
                    className="w-full px-2 py-1 bg-background text-foreground text-xs rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-muted-foreground font-bold uppercase">Attributes & Methods</label>
                  <textarea
                    value={editClassAttributes}
                    onChange={(e) => setEditClassAttributes(e.target.value)}
                    rows={4}
                    placeholder="e.g. - id: int&#10;+ getName(): string"
                    className="w-full px-2 py-1 bg-background text-foreground text-xs rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
                
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editClassIsAbstract}
                    onChange={(e) => setEditClassIsAbstract(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="font-medium">Abstract Class</span>
                </label>
                
                <div className="flex justify-end gap-1.5 pt-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setEditingNodeId(null)} 
                    className="h-7 px-2.5 text-xs font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleEditSubmit} className="h-7 px-2.5 text-xs font-semibold">
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-1">
                <input
                  type="text"
                  autoFocus
                  value={editInputValue}
                  onChange={(e) => setEditInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleEditSubmit();
                    if (e.key === "Escape") { setEditingNodeId(null); setEditingEdgeId(null); }
                  }}
                  className="w-full px-2 py-1 bg-background text-foreground text-xs rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button size="sm" onClick={handleEditSubmit} className="h-7 px-2 text-xs">
                  Save
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Canvas ReadOnly / Snapping Instructions Overlay */}
        <div className="absolute bottom-3 right-3 pointer-events-none bg-background/80 backdrop-blur border border-border/50 px-2.5 py-1 rounded-lg text-[9px] text-muted-foreground font-medium flex items-center gap-1.5 select-none">
          {readOnly ? (
            <span>Read-Only Diagram</span>
          ) : (
            <>
              <span className="w-1 h-1 rounded-full bg-cyan-400" />
              <span>Grid Snap 10px · Double-click to rename</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
