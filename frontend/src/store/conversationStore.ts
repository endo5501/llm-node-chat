import { create } from 'zustand';
import { apiClient, type Message, type Conversation, type SendMessageResponse } from '@/lib/api';

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
  
  // 現在の会話ID（バックエンドとの連携用）
  currentConversationId: string | null;
  
  // 会話一覧
  conversations: Conversation[];
  
  // ローディング状態
  isLoading: boolean;
  
  // エラー状態
  error: string | null;
  
  // アクション
  addMessage: (parentId: string | null, role: 'user' | 'assistant', content: string) => string;
  selectNode: (nodeId: string) => void;
  getCurrentConversation: () => MessageNode[];
  clearConversation: () => void;
  
  // バックエンドAPI統合アクション
  sendMessageToAPI: (content: string) => Promise<void>;
  loadConversationTree: (conversationId: string) => Promise<void>;
  createNewConversation: (title?: string) => Promise<void>;
  loadConversations: () => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  setCurrentConversation: (conversationId: string) => void;
  
  // ユーティリティ
  convertAPIMessageToNode: (message: Message) => MessageNode;
  buildTreeFromMessages: (treeData: any) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  nodes: {},
  currentNodeId: null,
  currentPath: [],
  currentConversationId: null,
  conversations: [],
  isLoading: false,
  error: null,

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
      } else {
        // ルートノードの場合
        newPath = [newId];
      }

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

  // バックエンドAPI統合メソッド
  sendMessageToAPI: async (content: string) => {
    const { currentConversationId, currentNodeId } = get();
    
    if (!currentConversationId) {
      throw new Error('No active conversation');
    }

    set({ isLoading: true, error: null });

    try {
      const response = await apiClient.sendMessage({
        conversation_id: currentConversationId,
        parent_id: currentNodeId,
        content,
      });

      // APIレスポンスからノードを作成
      const { convertAPIMessageToNode } = get();
      const userNode = convertAPIMessageToNode(response.user_message);
      const assistantNode = convertAPIMessageToNode(response.assistant_message);

      set((state) => {
        const newNodes = { ...state.nodes };
        
        // ユーザーメッセージを追加
        newNodes[userNode.id] = userNode;
        
        // 親ノードの子リストに追加
        if (userNode.parentId && newNodes[userNode.parentId]) {
          newNodes[userNode.parentId] = {
            ...newNodes[userNode.parentId],
            children: [...newNodes[userNode.parentId].children, userNode.id],
          };
        }

        // アシスタントメッセージを追加
        newNodes[assistantNode.id] = assistantNode;
        newNodes[userNode.id] = {
          ...newNodes[userNode.id],
          children: [assistantNode.id],
        };

        // 現在のパスを更新
        const newPath = [...state.currentPath, userNode.id, assistantNode.id];

        return {
          nodes: newNodes,
          currentNodeId: assistantNode.id,
          currentPath: newPath,
          isLoading: false,
        };
      });
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  },

  loadConversationTree: async (conversationId: string) => {
    set({ isLoading: true, error: null });

    try {
      const tree = await apiClient.getConversationTree(conversationId);
      const { buildTreeFromMessages } = get();
      
      buildTreeFromMessages(tree);
      
      set({ 
        currentConversationId: conversationId,
        isLoading: false 
      });
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load conversation' 
      });
      throw error;
    }
  },

  createNewConversation: async (title?: string) => {
    set({ isLoading: true, error: null });

    try {
      const conversation = await apiClient.createConversation(title);
      
      set((state) => ({
        currentConversationId: conversation.id,
        conversations: [conversation, ...state.conversations],
        nodes: {},
        currentNodeId: null,
        currentPath: [],
        isLoading: false,
      }));
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to create conversation' 
      });
      throw error;
    }
  },

  loadConversations: async () => {
    set({ isLoading: true, error: null });

    try {
      const conversations = await apiClient.getConversations();
      set({ 
        conversations,
        isLoading: false 
      });
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load conversations' 
      });
      throw error;
    }
  },

  deleteConversation: async (conversationId: string) => {
    set({ isLoading: true, error: null });

    try {
      await apiClient.deleteConversation(conversationId);
      
      set((state) => ({
        conversations: state.conversations.filter(c => c.id !== conversationId),
        currentConversationId: state.currentConversationId === conversationId ? null : state.currentConversationId,
        nodes: state.currentConversationId === conversationId ? {} : state.nodes,
        currentNodeId: state.currentConversationId === conversationId ? null : state.currentNodeId,
        currentPath: state.currentConversationId === conversationId ? [] : state.currentPath,
        isLoading: false,
      }));
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to delete conversation' 
      });
      throw error;
    }
  },

  setCurrentConversation: (conversationId: string) => {
    set({ currentConversationId: conversationId });
  },

  // ユーティリティメソッド
  convertAPIMessageToNode: (message: Message): MessageNode => {
    return {
      id: message.id,
      parentId: message.parent_id,
      role: message.role,
      content: message.content,
      createdAt: new Date(message.created_at),
      children: [],
    };
  },

  buildTreeFromMessages: (treeData: any) => {
    const nodes: Record<string, MessageNode> = {};
    
    // ツリーデータが空の場合は空の状態に設定
    if (!treeData.root_messages || treeData.root_messages.length === 0) {
      set({
        nodes: {},
        currentNodeId: null,
        currentPath: [],
      });
      return;
    }
    
    // ツリー構造を再帰的に変換
    const convertTreeNode = (treeNode: any): void => {
      const node: MessageNode = {
        id: treeNode.id.toString(),
        parentId: null, // 後で設定
        role: treeNode.role,
        content: treeNode.content,
        createdAt: new Date(treeNode.created_at),
        children: treeNode.children.map((child: any) => child.id.toString()),
      };
      
      nodes[node.id] = node;
      
      // 子ノードを再帰的に処理
      treeNode.children.forEach((child: any) => {
        convertTreeNode(child);
        // 子ノードの親IDを設定
        if (nodes[child.id.toString()]) {
          nodes[child.id.toString()].parentId = node.id;
        }
      });
    };
    
    // ルートメッセージから開始
    treeData.root_messages.forEach((rootMessage: any) => {
      convertTreeNode(rootMessage);
    });

    // 最新のメッセージを現在のノードとして設定
    const allNodes = Object.values(nodes);
    
    if (allNodes.length === 0) {
      set({
        nodes: {},
        currentNodeId: null,
        currentPath: [],
      });
      return;
    }
    
    const latestMessage = allNodes.reduce((latest, current) => 
      current.createdAt > latest.createdAt ? current : latest
    );

    // 現在のパスを構築
    const path: string[] = [];
    let currentId: string | null = latestMessage.id;
    
    while (currentId && nodes[currentId]) {
      path.unshift(currentId);
      currentId = nodes[currentId].parentId;
    }

    set({
      nodes,
      currentNodeId: latestMessage.id,
      currentPath: path,
    });
  },
}));
