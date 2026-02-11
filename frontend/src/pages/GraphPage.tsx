import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import ForceGraph2D from "react-force-graph-2d";
import {
  useGraphStore,
  type GraphNode,
  type GraphLink,
  CONCEPT_TYPE_COLORS,
  CONCEPT_TYPE_LABELS,
  type ConceptType,
} from "../stores/graphStore";
import { usePaperStore } from "../stores/paperStore";

// 階層レベルの定義（Y軸：上から下へ）
const HIERARCHY_LEVELS: Record<ConceptType, number> = {
  domain: 0,
  theory: 1,
  method: 2,
  model: 3,
  task: 3,
  dataset: 4,
  metric: 4,
  application: 5,
  concept: 2.5,
};

// 関係タイプの日本語ラベル
const RELATION_LABELS: Record<string, string> = {
  uses: "使用",
  extends: "拡張",
  improves: "改善",
  based_on: "基づく",
  applies_to: "適用",
  evaluates: "評価",
  requires: "必要",
  produces: "生成",
  part_of: "一部",
  related_to: "関連",
};

interface Node2D extends GraphNode {
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

interface Link2D extends Omit<GraphLink, "source" | "target"> {
  source: Node2D | string;
  target: Node2D | string;
}

export function GraphPage() {
  const { concepts, relations, getGraphData, clearGraph } = useGraphStore();
  const { papers } = usePaperStore();
  const graphData = getGraphData();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterTypes, setFilterTypes] = useState<Set<ConceptType>>(new Set());
  const hoveredNodeRef = useRef<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [connectedNodes, setConnectedNodes] = useState<Set<string>>(new Set());
  const [connectedLinks, setConnectedLinks] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [explorationMode, setExplorationMode] = useState(false);
  const [colorMode, setColorMode] = useState<"type" | "paper">("type");
  const [layoutMode, setLayoutMode] = useState<"hierarchy" | "timeline">("hierarchy");

  // 論文ごとのカラーパレット
  const PAPER_COLORS = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
    "#DDA0DD", "#F7DC6F", "#E056A0", "#56E0C0", "#7C9CFF",
  ];

  const paperColorMap = useMemo(() => {
    const map = new Map<string, string>();
    papers.forEach((paper, i) => {
      map.set(paper.id, PAPER_COLORS[i % PAPER_COLORS.length]);
    });
    return map;
  }, [papers]);

  // conceptId → paper IDs
  const conceptToPaperIds = useMemo(() => {
    const map = new Map<string, string[]>();
    papers.forEach((paper) => {
      paper.conceptIds.forEach((conceptId) => {
        const existing = map.get(conceptId) || [];
        existing.push(paper.id);
        map.set(conceptId, existing);
      });
    });
    return map;
  }, [papers]);

  // 概念がどの論文に由来するかのマップを作成
  const conceptToPapers = useMemo(() => {
    const map = new Map<string, string[]>();
    papers.forEach((paper) => {
      paper.conceptIds.forEach((conceptId) => {
        const existing = map.get(conceptId) || [];
        existing.push(paper.summary.title_ja || paper.filename);
        map.set(conceptId, existing);
      });
    });
    return map;
  }, [papers]);

  // conceptId → year (最も古い論文の年)
  const conceptToYear = useMemo(() => {
    const map = new Map<string, number>();
    papers.forEach((paper) => {
      const year = parseInt(paper.summary.year || "", 10);
      if (isNaN(year)) return;
      paper.conceptIds.forEach((cid) => {
        const existing = map.get(cid);
        if (!existing || year < existing) map.set(cid, year);
      });
    });
    return map;
  }, [papers]);

  // タイムラインで使用する年のリスト（ソート済み）
  const timelineYears = useMemo(() => {
    const years = new Set<number>();
    papers.forEach((p) => {
      const y = parseInt(p.summary.year || "", 10);
      if (!isNaN(y)) years.add(y);
    });
    return [...years].sort((a, b) => a - b);
  }, [papers]);

  // 論文別色分けでのノード色を取得
  const getNodeColorByPaper = useCallback((conceptId: string): string => {
    const pIds = conceptToPaperIds.get(conceptId);
    if (!pIds || pIds.length === 0) return "#B0B0B0";
    return paperColorMap.get(pIds[0]) || "#B0B0B0";
  }, [conceptToPaperIds, paperColorMap]);

  // 接続されたノードを計算
  const getConnectedNodesAndLinks = useCallback(
    (nodeId: string) => {
      const nodes = new Set<string>([nodeId]);
      const links = new Set<string>();

      graphData.links.forEach((link) => {
        const sourceId = typeof link.source === "string" ? link.source : (link.source as Node2D).id;
        const targetId = typeof link.target === "string" ? link.target : (link.target as Node2D).id;

        if (sourceId === nodeId) {
          nodes.add(targetId);
          links.add(`${sourceId}-${targetId}`);
        }
        if (targetId === nodeId) {
          nodes.add(sourceId);
          links.add(`${sourceId}-${targetId}`);
        }
      });

      return { nodes, links };
    },
    [graphData.links]
  );

  // コンテナサイズを監視
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width - (chatOpen ? 350 : 0),
          height: rect.height,
        });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [chatOpen]);

  // ズームコントロール
  const handleZoomIn = () => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() * 1.5, 300);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() / 1.5, 300);
    }
  };

  const handleZoomReset = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 50);
    }
  };

  // 検索処理
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === "") {
      setHighlightedNodes(new Set());
      return;
    }
    const lowerQuery = query.toLowerCase();
    const matchingIds = new Set(
      concepts
        .filter(
          (c) =>
            c.name_ja?.toLowerCase().includes(lowerQuery) ||
            c.name_en?.toLowerCase().includes(lowerQuery) ||
            c.name.toLowerCase().includes(lowerQuery) ||
            c.definition_ja?.toLowerCase().includes(lowerQuery) ||
            c.definition.toLowerCase().includes(lowerQuery)
        )
        .map((c) => c.id)
    );
    setHighlightedNodes(matchingIds);
  };

  // ノードクリック - 探索モード
  const handleNodeClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any) => {
      const graphNode = node as GraphNode;
      setSelectedNode(graphNode);
      setSidebarOpen(true);

      if (explorationMode) {
        const { nodes, links } = getConnectedNodesAndLinks(graphNode.id);
        setConnectedNodes(nodes);
        setConnectedLinks(links);
      }

      if (graphRef.current) {
        graphRef.current.centerAt(node.x, node.y, 500);
        graphRef.current.zoom(2, 500);
      }
    },
    [explorationMode, getConnectedNodesAndLinks]
  );

  // 背景クリック
  const handleBackgroundClick = () => {
    setSelectedNode(null);
    setConnectedNodes(new Set());
    setConnectedLinks(new Set());
  };

  const handleClearGraph = () => {
    if (confirm("ナレッジグラフをクリアしますか？")) {
      clearGraph();
      setSelectedNode(null);
      setConnectedNodes(new Set());
      setConnectedLinks(new Set());
    }
  };

  const toggleFilter = (type: ConceptType) => {
    setFilterTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // 選択した概念についてAIに質問
  const askAboutConcept = (concept: GraphNode) => {
    const relatedConcepts = getConnectedNodesAndLinks(concept.id);
    const relatedNames = Array.from(relatedConcepts.nodes)
      .filter((id) => id !== concept.id)
      .map((id) => {
        const c = concepts.find((c) => c.id === id);
        return c?.name_ja || c?.name || id;
      });

    const question = `「${concept.name_ja || concept.name}」について詳しく教えてください。${
      relatedNames.length > 0 ? `関連する概念: ${relatedNames.join(", ")}` : ""
    }`;
    setChatInput(question);
    setChatOpen(true);
  };

  // チャット送信（シンプルなモック）
  const handleChatSend = () => {
    if (!chatInput.trim()) return;

    setChatMessages((prev) => [...prev, { role: "user", content: chatInput }]);

    // 実際のAI応答はバックエンドと連携する必要がある
    // ここではコンテキストを示すモック応答
    const contextInfo = selectedNode
      ? `選択中の概念「${selectedNode.name_ja || selectedNode.name}」について`
      : "ナレッジグラフ全体について";

    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `${contextInfo}のご質問ですね。\n\n現在のグラフには ${concepts.length} の概念と ${relations.length} の関係があります。\n\nより詳細な回答を得るには、チャットページで会話を続けてください。`,
        },
      ]);
    }, 500);

    setChatInput("");
  };

  // フィルタリングされたグラフデータ
  const filteredGraphData = useMemo(
    () => ({
      nodes:
        filterTypes.size === 0
          ? graphData.nodes
          : graphData.nodes.filter((n) => filterTypes.has(n.concept_type)),
      links:
        filterTypes.size === 0
          ? graphData.links
          : graphData.links.filter((l) => {
              const sourceNode = graphData.nodes.find(
                (n) => n.id === l.source || n.id === (l.source as unknown as { id: string })?.id
              );
              const targetNode = graphData.nodes.find(
                (n) => n.id === l.target || n.id === (l.target as unknown as { id: string })?.id
              );
              return (
                sourceNode && targetNode && filterTypes.has(sourceNode.concept_type) && filterTypes.has(targetNode.concept_type)
              );
            }),
    }),
    [graphData, filterTypes]
  );

  const usedTypes = new Set(concepts.map((c) => c.concept_type || "concept"));

  // レイアウト（静的配置）
  useEffect(() => {
    if (graphData.nodes.length > 0) {
      if (layoutMode === "timeline" && timelineYears.length > 0) {
        // タイムラインレイアウト: X軸=年, Y軸=階層
        const yearToX = new Map<number, number>();
        const xSpacing = 300;
        timelineYears.forEach((year, i) => {
          yearToX.set(year, i * xSpacing);
        });

        // 年ごとにノードをグループ化
        const nodesByYear = new Map<number, Node2D[]>();
        graphData.nodes.forEach((node) => {
          const n = node as Node2D;
          const year = conceptToYear.get(n.id);
          const key = year || 0;
          if (!nodesByYear.has(key)) nodesByYear.set(key, []);
          nodesByYear.get(key)!.push(n);
        });

        graphData.nodes.forEach((node) => {
          const n = node as Node2D;
          const year = conceptToYear.get(n.id);
          const xBase = year ? (yearToX.get(year) || 0) : -xSpacing;
          const nodesInYear = nodesByYear.get(year || 0) || [];
          const indexInYear = nodesInYear.indexOf(n);
          const ySpacing = 80;
          const yStart = -(nodesInYear.length - 1) * ySpacing / 2;

          n.fx = xBase;
          n.x = xBase;
          n.fy = yStart + indexInYear * ySpacing;
          n.y = n.fy;
        });
      } else {
        // 階層レイアウト: X軸=均等配置, Y軸=概念タイプ
        const nodesByType = new Map<string, Node2D[]>();
        graphData.nodes.forEach((node) => {
          const n = node as Node2D;
          const type = n.concept_type || "concept";
          if (!nodesByType.has(type)) nodesByType.set(type, []);
          nodesByType.get(type)!.push(n);
        });

        graphData.nodes.forEach((node) => {
          const n = node as Node2D;
          const type = n.concept_type || "concept";
          const nodesOfType = nodesByType.get(type) || [];
          const indexInType = nodesOfType.indexOf(n);
          const totalInType = nodesOfType.length;

          const yPos = (HIERARCHY_LEVELS[n.concept_type] || 2.5) * 100;
          n.fy = yPos;
          n.y = yPos;

          const spacing = 150;
          const startX = -(totalInType - 1) * spacing / 2;
          const xPos = startX + indexInType * spacing;
          n.fx = xPos;
          n.x = xPos;
        });
      }

      // シミュレーションを停止
      if (graphRef.current) {
        graphRef.current.d3Force("charge", null);
        graphRef.current.d3Force("link", null);
        graphRef.current.d3Force("center", null);
      }
    }
  }, [graphData.nodes, layoutMode, timelineYears, conceptToYear]);

  // ノード描画
  const nodeCanvasObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const graphNode = node as Node2D;
      const label = graphNode.name_ja || graphNode.name;
      const fontSize = Math.max(10, 12 / globalScale);
      const nodeRadius = 14;
      const isHovered = hoveredNodeRef.current?.id === graphNode.id;
      const isSelected = selectedNode?.id === graphNode.id;
      const isHighlighted = highlightedNodes.has(graphNode.id);
      const isConnected = connectedNodes.has(graphNode.id);
      const isDimmed =
        (highlightedNodes.size > 0 && !isHighlighted) ||
        (explorationMode && connectedNodes.size > 0 && !isConnected);

      ctx.globalAlpha = isDimmed ? 0.15 : 1;

      // グロー効果
      if (isSelected || isHighlighted || isConnected) {
        ctx.beginPath();
        ctx.arc(node.x || 0, node.y || 0, nodeRadius + 8, 0, 2 * Math.PI);
        const gradient = ctx.createRadialGradient(node.x || 0, node.y || 0, nodeRadius, node.x || 0, node.y || 0, nodeRadius + 12);
        const glowColor = isHighlighted ? "rgba(255, 221, 0, 0.6)" : isSelected ? "rgba(255, 255, 255, 0.5)" : "rgba(79, 70, 229, 0.4)";
        gradient.addColorStop(0, glowColor);
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // ノード円
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, nodeRadius, 0, 2 * Math.PI);
      const baseColor = colorMode === "paper" ? getNodeColorByPaper(graphNode.id) : (graphNode.color || "#4f46e5");
      const nodeGradient = ctx.createRadialGradient((node.x || 0) - 4, (node.y || 0) - 4, 0, node.x || 0, node.y || 0, nodeRadius);
      nodeGradient.addColorStop(0, lightenColor(baseColor, 30));
      nodeGradient.addColorStop(1, baseColor);
      ctx.fillStyle = nodeGradient;
      ctx.fill();

      // 枠線
      if (isHovered || isSelected || isHighlighted || isConnected) {
        ctx.strokeStyle = isHighlighted ? "#ffdd00" : isConnected ? "#a5b4fc" : "#fff";
        ctx.lineWidth = 3 / globalScale;
        ctx.stroke();
      }

      // 論文由来マーク
      const paperIds = conceptToPaperIds.get(graphNode.id) || [];
      if (colorMode === "paper" && paperIds.length > 1) {
        // マルチカラーリング（複数論文に属する概念）
        const ringRadius = nodeRadius + 4;
        const sliceAngle = (2 * Math.PI) / paperIds.length;
        paperIds.forEach((pId, i) => {
          ctx.beginPath();
          ctx.arc(node.x || 0, node.y || 0, ringRadius, sliceAngle * i - Math.PI / 2, sliceAngle * (i + 1) - Math.PI / 2);
          ctx.arc(node.x || 0, node.y || 0, nodeRadius + 1, sliceAngle * (i + 1) - Math.PI / 2, sliceAngle * i - Math.PI / 2, true);
          ctx.closePath();
          ctx.fillStyle = paperColorMap.get(pId) || "#888";
          ctx.fill();
        });
      } else if (paperIds.length > 1) {
        ctx.beginPath();
        ctx.arc((node.x || 0) + nodeRadius - 2, (node.y || 0) - nodeRadius + 2, 6, 0, 2 * Math.PI);
        ctx.fillStyle = "#f59e0b";
        ctx.fill();
        ctx.font = `bold ${8}px sans-serif`;
        ctx.fillStyle = "#000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(paperIds.length), (node.x || 0) + nodeRadius - 2, (node.y || 0) - nodeRadius + 2);
      }

      // ラベル
      ctx.font = `600 ${fontSize}px "Inter", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const textWidth = ctx.measureText(label).width;
      const bgPadding = 4;
      const bgHeight = fontSize + bgPadding * 2;
      const bgY = (node.y || 0) + nodeRadius + 8;

      ctx.fillStyle = isHighlighted ? "rgba(255, 221, 0, 0.95)" : isConnected ? "rgba(79, 70, 229, 0.9)" : "rgba(13, 13, 20, 0.9)";
      roundRect(ctx, (node.x || 0) - textWidth / 2 - bgPadding, bgY - bgHeight / 2, textWidth + bgPadding * 2, bgHeight, 4);
      ctx.fill();

      ctx.fillStyle = isHighlighted ? "#000" : "#fff";
      ctx.fillText(label, node.x || 0, bgY);

      ctx.globalAlpha = 1;
    },
    [selectedNode, highlightedNodes, connectedNodes, explorationMode, conceptToPaperIds, colorMode, paperColorMap, getNodeColorByPaper]
  );

  // タイムライン軸の描画（キャンバス上に年ラベルと縦線）
  const renderTimelineAxis = useCallback(
    (ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (layoutMode !== "timeline" || timelineYears.length === 0) return;

      const xSpacing = 300;

      timelineYears.forEach((year, i) => {
        const x = i * xSpacing;

        // 縦のガイドライン（薄い点線）
        ctx.save();
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = "rgba(79, 70, 229, 0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, -2000);
        ctx.lineTo(x, 2000);
        ctx.stroke();
        ctx.restore();

        // 年ラベル（上部）
        const fontSize = Math.max(14, 18 / globalScale);
        ctx.font = `bold ${fontSize}px "Inter", system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        // 背景ボックス
        const labelText = String(year);
        const textWidth = ctx.measureText(labelText).width;
        const padding = 8;
        const boxHeight = fontSize + padding * 2;
        const boxY = -800;

        ctx.fillStyle = "rgba(79, 70, 229, 0.2)";
        roundRect(ctx, x - textWidth / 2 - padding, boxY - padding, textWidth + padding * 2, boxHeight, 6);
        ctx.fill();

        ctx.fillStyle = "#a5b4fc";
        ctx.fillText(labelText, x, boxY);
      });

      // 不明な年（左端）
      const unknownX = -xSpacing;
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(150, 150, 150, 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(unknownX, -2000);
      ctx.lineTo(unknownX, 2000);
      ctx.stroke();
      ctx.restore();

      const fontSize = Math.max(12, 14 / globalScale);
      ctx.font = `${fontSize}px "Inter", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#666";
      ctx.fillText("不明", unknownX, -800);
    },
    [layoutMode, timelineYears]
  );

  // リンク描画（関係タイプ表示）
  const linkCanvasObject = useCallback(
    (link: Link2D, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const source = typeof link.source === "string" ? null : link.source;
      const target = typeof link.target === "string" ? null : link.target;
      if (!source || !target) return;

      const linkId = `${source.id}-${target.id}`;
      const isConnectedLink = connectedLinks.has(linkId);
      const isDimmed = explorationMode && connectedNodes.size > 0 && !isConnectedLink;

      ctx.globalAlpha = isDimmed ? 0.1 : 0.8;

      // ラベル表示（ズームレベルが高い時のみ）
      if (globalScale > 0.8 && link.label) {
        const midX = (source.x! + target.x!) / 2;
        const midY = (source.y! + target.y!) / 2;
        const labelText = RELATION_LABELS[link.label] || link.label;
        const fontSize = Math.max(8, 10 / globalScale);

        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const textWidth = ctx.measureText(labelText).width;
        ctx.fillStyle = isConnectedLink ? "rgba(79, 70, 229, 0.9)" : "rgba(30, 30, 50, 0.9)";
        ctx.fillRect(midX - textWidth / 2 - 3, midY - fontSize / 2 - 2, textWidth + 6, fontSize + 4);

        ctx.fillStyle = isConnectedLink ? "#fff" : "#aaa";
        ctx.fillText(labelText, midX, midY);
      }

      ctx.globalAlpha = 1;
    },
    [connectedNodes, connectedLinks, explorationMode]
  );

  // 選択中ノードの関連情報
  const selectedNodeRelations = useMemo(() => {
    if (!selectedNode) return [];
    return graphData.links
      .filter((l) => {
        const sourceId = typeof l.source === "string" ? l.source : (l.source as Node2D).id;
        const targetId = typeof l.target === "string" ? l.target : (l.target as Node2D).id;
        return sourceId === selectedNode.id || targetId === selectedNode.id;
      })
      .map((l) => {
        const sourceId = typeof l.source === "string" ? l.source : (l.source as Node2D).id;
        const targetId = typeof l.target === "string" ? l.target : (l.target as Node2D).id;
        const otherId = sourceId === selectedNode.id ? targetId : sourceId;
        const otherNode = concepts.find((c) => c.id === otherId);
        const direction = sourceId === selectedNode.id ? "outgoing" : "incoming";
        return {
          otherNode,
          relation: l.label,
          direction,
        };
      });
  }, [selectedNode, graphData.links, concepts]);

  const hasData = graphData.nodes.length > 0;

  return (
    <div className="graph-page-new">
      <div className="graph-main-container" ref={containerRef}>
        {!hasData ? (
          <div className="graph-empty-state">
            <div className="empty-icon">🔬</div>
            <h3>ナレッジグラフが空です</h3>
            <p>
              ホームページから論文をアップロードして
              <br />
              概念を抽出してください
            </p>
          </div>
        ) : (
          <>
            <ForceGraph2D
              ref={graphRef}
              graphData={filteredGraphData}
              nodeCanvasObject={nodeCanvasObject}
              linkCanvasObjectMode={() => "after"}
              linkCanvasObject={linkCanvasObject}
              nodePointerAreaPaint={(node, color, ctx) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x || 0, node.y || 0, 18, 0, 2 * Math.PI);
                ctx.fill();
              }}
              linkDirectionalArrowLength={8}
              linkDirectionalArrowRelPos={0.85}
              linkWidth={(link) => {
                const l = link as Link2D;
                const sourceId = typeof l.source === "string" ? l.source : l.source.id;
                const targetId = typeof l.target === "string" ? l.target : l.target.id;
                return connectedLinks.has(`${sourceId}-${targetId}`) ? 3 : 1.5;
              }}
              linkColor={(link) => {
                const l = link as Link2D;
                const sourceId = typeof l.source === "string" ? l.source : l.source.id;
                const targetId = typeof l.target === "string" ? l.target : l.target.id;
                return connectedLinks.has(`${sourceId}-${targetId}`) ? "rgba(165, 180, 252, 0.8)" : "rgba(100, 120, 180, 0.4)";
              }}
              linkCurvature={0.15}
              onNodeClick={handleNodeClick}
              onNodeHover={(node) => { hoveredNodeRef.current = node as GraphNode | null; }}
              onBackgroundClick={handleBackgroundClick}
              onRenderFramePre={(ctx, globalScale) => renderTimelineAxis(ctx, globalScale)}
              backgroundColor="transparent"
              width={dimensions.width}
              height={dimensions.height}
              cooldownTicks={0}
              cooldownTime={0}
              enableNodeDrag={false}
            />


            {/* フローティングヘッダー */}
            <div className="graph-floating-header">
              <div className="floating-title">
                <h2>ナレッジグラフ</h2>
                <div className="graph-stats-inline">
                  <span><strong>{concepts.length}</strong> 概念</span>
                  <span><strong>{relations.length}</strong> 関係</span>
                  <span><strong>{papers.length}</strong> 論文</span>
                </div>
              </div>
            </div>

            {/* フローティングコントロール */}
            <div className="graph-floating-controls">
              <button
                className={`mode-toggle ${explorationMode ? "active" : ""}`}
                onClick={() => {
                  setExplorationMode(!explorationMode);
                  if (!explorationMode) {
                    setConnectedNodes(new Set());
                    setConnectedLinks(new Set());
                  }
                }}
                title="探索モード"
              >
                🔍
              </button>
              {papers.length > 0 && (
                <button
                  className={`color-mode-toggle ${colorMode === "paper" ? "active" : ""}`}
                  onClick={() => setColorMode(colorMode === "type" ? "paper" : "type")}
                  title={colorMode === "type" ? "論文別色分けに切替" : "タイプ別色分けに切替"}
                >
                  📄
                </button>
              )}
              {timelineYears.length > 0 && (
                <button
                  className={`mode-toggle ${layoutMode === "timeline" ? "active" : ""}`}
                  onClick={() => {
                    setLayoutMode(layoutMode === "hierarchy" ? "timeline" : "hierarchy");
                    setTimeout(() => {
                      if (graphRef.current) graphRef.current.zoomToFit(400, 50);
                    }, 100);
                  }}
                  title={layoutMode === "hierarchy" ? "タイムラインに切替" : "階層レイアウトに切替"}
                >
                  📅
                </button>
              )}
              <div className="control-group search-group">
                <input
                  type="text"
                  placeholder="概念を検索..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="floating-search"
                />
                {searchQuery && (
                  <button className="search-clear-btn" onClick={() => handleSearch("")}>×</button>
                )}
                {highlightedNodes.size > 0 && <span className="search-count">{highlightedNodes.size}件</span>}
              </div>
              <div className="control-group zoom-group">
                <button onClick={handleZoomIn} title="ズームイン">+</button>
                <button onClick={handleZoomReset} title="フィット">⊙</button>
                <button onClick={handleZoomOut} title="ズームアウト">−</button>
              </div>
              <button
                className={`chat-toggle ${chatOpen ? "active" : ""}`}
                onClick={() => setChatOpen(!chatOpen)}
                title="AIチャット"
              >
                💬
              </button>
              <button
                className={`sidebar-toggle ${sidebarOpen ? "active" : ""}`}
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title="サイドバー"
              >
                ☰
              </button>
            </div>

            {/* フローティング凡例 */}
            <div className="graph-floating-legend">
              <div className="legend-title">{colorMode === "type" ? "タイプ" : "論文"}</div>
              <div className="legend-chips">
                {colorMode === "type" ? (
                  (Object.keys(CONCEPT_TYPE_COLORS) as ConceptType[])
                    .filter((type) => usedTypes.has(type))
                    .map((type) => (
                      <button
                        key={type}
                        className={`legend-chip ${filterTypes.has(type) ? "active" : ""} ${filterTypes.size > 0 && !filterTypes.has(type) ? "dimmed" : ""}`}
                        onClick={() => toggleFilter(type)}
                      >
                        <span className="chip-dot" style={{ backgroundColor: CONCEPT_TYPE_COLORS[type] }} />
                        {CONCEPT_TYPE_LABELS[type]}
                        <span className="chip-count">{concepts.filter((c) => (c.concept_type || "concept") === type).length}</span>
                      </button>
                    ))
                ) : (
                  papers.map((paper) => (
                    <button key={paper.id} className="legend-chip paper-legend">
                      <span className="chip-dot" style={{ backgroundColor: paperColorMap.get(paper.id) }} />
                      <span className="paper-legend-title">{paper.summary.title_ja || paper.summary.title || paper.filename}</span>
                      <span className="chip-count">{paper.conceptIds.length}</span>
                    </button>
                  ))
                )}
              </div>
              {colorMode === "type" && filterTypes.size > 0 && (
                <button className="clear-filter" onClick={() => setFilterTypes(new Set())}>クリア</button>
              )}
              {explorationMode && (
                <div className="exploration-hint">
                  🔍 探索モード: ノードをクリックして接続を表示
                </div>
              )}
            </div>

            {/* AIチャットパネル */}
            {chatOpen && (
              <div className="graph-chat-panel">
                <div className="chat-panel-header">
                  <h4>AIに質問</h4>
                  <button onClick={() => setChatOpen(false)}>×</button>
                </div>
                <div className="chat-panel-messages">
                  {chatMessages.length === 0 ? (
                    <div className="chat-empty">
                      {selectedNode ? (
                        <p>「{selectedNode.name_ja || selectedNode.name}」について質問できます</p>
                      ) : (
                        <p>概念を選択してAIに質問しましょう</p>
                      )}
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} className={`chat-message ${msg.role}`}>
                        {msg.content}
                      </div>
                    ))
                  )}
                </div>
                <div className="chat-panel-input">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
                    placeholder="質問を入力..."
                  />
                  <button onClick={handleChatSend}>送信</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* サイドバー */}
      <aside className={`graph-sidebar-new ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header-new">
          <h3>{selectedNode ? "概念詳細" : "概念一覧"}</h3>
          <div className="sidebar-actions">
            {concepts.length > 0 && !selectedNode && (
              <button className="clear-btn-new" onClick={handleClearGraph}>クリア</button>
            )}
            <button className="close-sidebar" onClick={() => setSidebarOpen(false)}>×</button>
          </div>
        </div>

        {selectedNode ? (
          <div className="concept-detail-new">
            <div className="detail-type-badge" style={{ backgroundColor: selectedNode.color }}>
              {CONCEPT_TYPE_LABELS[selectedNode.concept_type]}
            </div>
            <h4>{selectedNode.name_ja || selectedNode.name}</h4>
            {selectedNode.name_en && selectedNode.name_en !== selectedNode.name_ja && (
              <p className="detail-name-en">{selectedNode.name_en}</p>
            )}
            <p className="detail-definition">{selectedNode.definition_ja || selectedNode.definition}</p>

            {/* 論文由来 */}
            {conceptToPapers.get(selectedNode.id) && (
              <div className="detail-papers">
                <h5>由来論文</h5>
                <ul>
                  {conceptToPapers.get(selectedNode.id)?.map((title, i) => (
                    <li key={i}>{title}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 関連する概念 */}
            {selectedNodeRelations.length > 0 && (
              <div className="detail-relations">
                <h5>関連する概念</h5>
                <ul>
                  {selectedNodeRelations.map((rel, i) => (
                    <li
                      key={i}
                      onClick={() => {
                        if (rel.otherNode) {
                          const node = graphData.nodes.find((n) => n.id === rel.otherNode!.id);
                          if (node) handleNodeClick(node);
                        }
                      }}
                    >
                      <span className="relation-direction">{rel.direction === "outgoing" ? "→" : "←"}</span>
                      <span className="relation-type">{RELATION_LABELS[rel.relation] || rel.relation}</span>
                      <span className="relation-target">{rel.otherNode?.name_ja || rel.otherNode?.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="detail-actions">
              <button className="ask-ai-btn" onClick={() => askAboutConcept(selectedNode)}>
                💬 AIに質問
              </button>
              <button className="back-to-list" onClick={() => setSelectedNode(null)}>
                ← 一覧に戻る
              </button>
            </div>
          </div>
        ) : (
          <ul className="concept-list-new">
            {concepts.map((concept) => (
              <li
                key={concept.id}
                className={`${highlightedNodes.has(concept.id) ? "highlighted" : ""} ${connectedNodes.has(concept.id) ? "connected" : ""}`}
                onClick={() =>
                  handleNodeClick({
                    id: concept.id,
                    name: concept.name,
                    name_en: concept.name_en || "",
                    name_ja: concept.name_ja || "",
                    definition: concept.definition,
                    definition_ja: concept.definition_ja || concept.definition,
                    concept_type: concept.concept_type || "concept",
                    color: CONCEPT_TYPE_COLORS[concept.concept_type || "concept"],
                    val: 1,
                  })
                }
              >
                <span className="list-dot" style={{ backgroundColor: CONCEPT_TYPE_COLORS[concept.concept_type || "concept"] }} />
                <span className="list-name">{concept.name_ja || concept.name}</span>
                {(conceptToPapers.get(concept.id)?.length || 0) > 1 && (
                  <span className="paper-count">{conceptToPapers.get(concept.id)?.length}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return `rgb(${R}, ${G}, ${B})`;
}
