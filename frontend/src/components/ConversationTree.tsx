'use client';

import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useConversationStore } from '@/store/conversationStore';

// カスタムノードコンポーネント
const MessageNodeComponent = ({ data }: { data: { id: string; role: string; content: string; createdAt: Date } }) => {
  const { selectNode, currentNodeId } = useConversationStore();
  const isSelected = currentNodeId === data.id;
  const isAssistant = data.role === 'assistant';
  
  const handleClick = () => {
    if (isAssistant) {
      selectNode(data.id);
    }
  };

  // メッセージの最初の5文字を表示
  const displayText = data.content.slice(0, 5) + (data.content.length > 5 ? '...' : '');

  return (
    <div
      className={`
        px-3 py-2 rounded-lg border-2 cursor-pointer min-w-[80px] text-center text-sm
        ${isAssistant ? 'cursor-pointer' : 'cursor-default'}
        ${isSelected ? 'border-blue-500 bg-blue-100' : 'border-gray-300 bg-white'}
        ${data.role === 'user' ? 'bg-green-50 border-green-300' : ''}
        ${data.role === 'assistant' ? 'bg-blue-50 border-blue-300 hover:bg-blue-100' : ''}
        transition-colors duration-200
      `}
      onClick={handleClick}
    >
      <div className="font-medium text-xs text-gray-600 mb-1">
        {data.role === 'user' ? 'User' : 'AI'}
      </div>
      <div className="text-gray-800">{displayText}</div>
    </div>
  );
};

// ノードタイプの定義
const nodeTypes = {
  messageNode: MessageNodeComponent,
};

export const ConversationTree: React.FC = () => {
  const { nodes: storeNodes } = useConversationStore();

  // React Flow用のノードとエッジを生成
  const { nodes, edges } = useMemo(() => {
    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];
    const nodePositions: Record<string, { x: number; y: number }> = {};

    // ノードの配置を計算
    const calculatePositions = (nodeId: string, level: number = 0, siblingIndex: number = 0) => {
      const node = storeNodes[nodeId];
      if (!node) return;

      const x = siblingIndex * 150; // 横の間隔
      const y = level * 100; // 縦の間隔

      nodePositions[nodeId] = { x, y };

      // 子ノードの処理
      node.children.forEach((childId, index) => {
        calculatePositions(childId, level + 1, siblingIndex + index);
      });
    };

    // ルートノードから開始
    const rootNodes = Object.values(storeNodes).filter(node => !node.parentId);
    rootNodes.forEach((rootNode, index) => {
      calculatePositions(rootNode.id, 0, index);
    });

    // React Flow用のノードを作成
    Object.values(storeNodes).forEach((node) => {
      const position = nodePositions[node.id] || { x: 0, y: 0 };
      
      flowNodes.push({
        id: node.id,
        type: 'messageNode',
        position,
        data: {
          id: node.id,
          role: node.role,
          content: node.content,
          createdAt: node.createdAt,
        },
      });

      // エッジを作成
      if (node.parentId && storeNodes[node.parentId]) {
        flowEdges.push({
          id: `edge-${node.parentId}-${node.id}`,
          source: node.parentId,
          target: node.id,
          type: 'smoothstep',
          style: { stroke: '#6b7280', strokeWidth: 2 },
        });
      }
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [storeNodes]);

  const [reactFlowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [reactFlowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  // ノードとエッジの更新
  React.useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.2,
        }}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
};
