'use client';

import React, { useCallback, useMemo, useRef } from 'react';
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
  ReactFlowInstance,
  MarkerType,
  Handle,
  Position,
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
        px-2 py-1 rounded-lg border-2 cursor-pointer min-w-[60px] text-center text-xs relative
        ${isAssistant ? 'cursor-pointer' : 'cursor-default'}
        ${isSelected ? 'border-blue-500 bg-blue-100' : 'border-gray-300 bg-white'}
        ${data.role === 'user' ? 'bg-green-50 border-green-300' : ''}
        ${data.role === 'assistant' ? 'bg-blue-50 border-blue-300 hover:bg-blue-100' : ''}
        transition-colors duration-200
      `}
      onClick={handleClick}
    >
      {/* 上部のハンドル（入力用） */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#6b7280',
          width: 8,
          height: 8,
          border: '2px solid #fff',
        }}
      />
      
      <div className="text-gray-800">{displayText}</div>
      
      {/* 下部のハンドル（出力用） */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#6b7280',
          width: 8,
          height: 8,
          border: '2px solid #fff',
        }}
      />
    </div>
  );
};

// ノードタイプの定義
const nodeTypes = {
  messageNode: MessageNodeComponent,
};

export const ConversationTree: React.FC = () => {
  const { nodes: storeNodes, currentNodeId } = useConversationStore();
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  // React Flow用のノードとエッジを生成
  const { nodes, edges } = useMemo(() => {
    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];
    const nodePositions: Record<string, { x: number; y: number }> = {};

    console.log('=== ConversationTree Debug ===');
    console.log('Store nodes:', storeNodes);

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
    console.log('Root nodes:', rootNodes);
    
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

      // エッジを作成（矢印線）
      if (node.parentId && storeNodes[node.parentId]) {
        console.log(`Creating edge: ${node.parentId} -> ${node.id}`);
        flowEdges.push({
          id: `edge-${node.parentId}-${node.id}`,
          source: node.parentId,
          target: node.id,
          sourceHandle: null,
          targetHandle: null,
          type: 'default',
          style: { 
            stroke: '#6b7280', 
            strokeWidth: 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: '#6b7280',
          },
        });
      } else {
        console.log(`No edge for node ${node.id}, parentId: ${node.parentId}`);
      }
    });

    console.log('Generated nodes:', flowNodes);
    console.log('Generated edges:', flowEdges);
    console.log('=== End Debug ===');

    return { nodes: flowNodes, edges: flowEdges };
  }, [storeNodes]);

  const [reactFlowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [reactFlowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  // ノードとエッジの更新
  React.useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges]);

  // 新しいノードが追加された時に中央に表示
  React.useEffect(() => {
    if (currentNodeId && reactFlowInstance.current) {
      const currentNode = nodes.find(node => node.id === currentNodeId);
      if (currentNode) {
        reactFlowInstance.current.setCenter(
          currentNode.position.x + 50, // ノードの中央
          currentNode.position.y + 25,
          { zoom: 1 }
        );
      }
    }
  }, [currentNodeId, nodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.2,
        }}
        defaultEdgeOptions={{
          type: 'default',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
          },
        }}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
};
