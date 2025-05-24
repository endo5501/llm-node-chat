import { create } from 'zustand';

export interface MessageNode {
  id: string;
  parentId: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  children: string[];
}

export interface ConversationState {
  // メッセージノードの管理
  nodes: Record<string, MessageNode>;
  
  // 現在選択されているノード
  currentNodeId: string | null;
  
  // 現在の会話パス（ルートから現在のノードまで）
  currentPath: string[];
  
  // アクション
  addMessage: (parentId: string | null, role: 'user' | 'assistant', content: string) => string;
  selectNode: (nodeId: string) => void;
  getCurrentConversation: () => MessageNode[];
  clearConversation: () => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  nodes: {},
  currentNodeId: null,
  currentPath: [],

  addMessage: (parentId, role, content) => {
    const newId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNode: MessageNode = {
      id: newId,
      parentId,
      role,
      content,
      createdAt: new Date(),
      children: [],
    };

    set((state) => {
      const newNodes = { ...state.nodes };
      newNodes[newId] = newNode;

      // 親ノードの子リストに追加
      if (parentId && newNodes[parentId]) {
        newNodes[parentId] = {
          ...newNodes[parentId],
          children: [...newNodes[parentId].children, newId],
        };
      }

      // 現在のノードを新しいノードに設定
      const newPath = parentId ? [...state.currentPath, newId] : [newId];

      return {
        nodes: newNodes,
        currentNodeId: newId,
        currentPath: newPath,
      };
    });

    return newId;
  },

  selectNode: (nodeId) => {
    const { nodes } = get();
    if (!nodes[nodeId]) return;

    // 選択されたノードからルートまでのパスを構築
    const path: string[] = [];
    let currentId: string | null = nodeId;

    while (currentId) {
      path.unshift(currentId);
      currentId = nodes[currentId]?.parentId || null;
    }

    set({
      currentNodeId: nodeId,
      currentPath: path,
    });
  },

  getCurrentConversation: () => {
    const { nodes, currentPath } = get();
    return currentPath.map(id => nodes[id]).filter(Boolean);
  },

  clearConversation: () => {
    set({
      nodes: {},
      currentNodeId: null,
      currentPath: [],
    });
  },
}));
