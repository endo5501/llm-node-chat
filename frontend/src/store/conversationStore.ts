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
    console.log('=== ConversationStore addMessage ===');
    console.log('Input - parentId:', parentId, 'role:', role, 'content:', content);
    
    const newId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNode: MessageNode = {
      id: newId,
      parentId,
      role,
      content,
      createdAt: new Date(),
      children: [],
    };

    console.log('Created new node:', newNode);

    set((state) => {
      console.log('Current state before update:', state);
      
      const newNodes = { ...state.nodes };
      newNodes[newId] = newNode;

      // 親ノードの子リストに追加
      if (parentId && newNodes[parentId]) {
        console.log('Adding child to parent node:', parentId);
        newNodes[parentId] = {
          ...newNodes[parentId],
          children: [...newNodes[parentId].children, newId],
        };
      } else {
        console.log('No parent node found or parentId is null');
      }

      // 現在のパスを正しく構築
      let newPath: string[];
      if (parentId) {
        // 親ノードからルートまでのパスを構築
        const parentPath: string[] = [];
        let currentId: string | null = parentId;
        while (currentId) {
          parentPath.unshift(currentId);
          currentId = newNodes[currentId]?.parentId || null;
        }
        newPath = [...parentPath, newId];
        console.log('Built path with parent:', newPath);
      } else {
        // ルートノードの場合
        newPath = [newId];
        console.log('Built root path:', newPath);
      }

      const newState = {
        nodes: newNodes,
        currentNodeId: newId,
        currentPath: newPath,
      };

      console.log('New state after update:', newState);
      console.log('=== End ConversationStore addMessage ===');

      return newState;
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
