import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversationStore } from './conversationStore';

// Mock external dependencies
vi.mock('@/lib/api', () => ({
  apiClient: {
    sendMessage: vi.fn(),
    getConversationTree: vi.fn(),
    createConversation: vi.fn(),
    getConversations: vi.fn(),
    deleteConversation: vi.fn(),
    updateConversationTitle: vi.fn(),
  },
}));

vi.mock('@/lib/websocket', () => ({
  getWebSocketClient: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(() => false),
    sendChatMessage: vi.fn(),
    onMessage: vi.fn(),
  })),
}));

// Helper to reset store before each test
const resetStore = () => {
  const { clearConversation } = useConversationStore.getState();
  clearConversation();
  useConversationStore.setState({
    conversations: [],
    currentConversationId: null,
    isLoading: false,
    error: null,
    isStreaming: false,
    streamingNodeId: null,
    isWebSocketConnected: false,
  });
};

describe('conversationStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('adds a root message and updates state', () => {
    const id = useConversationStore.getState().addMessage(null, 'user', 'hello');
    const state = useConversationStore.getState();
    expect(state.nodes[id].content).toBe('hello');
    expect(state.nodes[id].parentId).toBe(null);
    expect(state.currentNodeId).toBe(id);
    expect(state.currentPath).toEqual([id]);
  });

  it('adds a child message and links to parent', () => {
    const parentId = useConversationStore.getState().addMessage(null, 'user', 'a');
    const childId = useConversationStore.getState().addMessage(parentId, 'assistant', 'b');
    const state = useConversationStore.getState();
    expect(state.nodes[parentId].children).toContain(childId);
    expect(state.currentNodeId).toBe(childId);
    expect(state.currentPath).toEqual([parentId, childId]);
  });

  it('selectNode updates current path correctly', () => {
    const a = useConversationStore.getState().addMessage(null, 'user', 'a');
    useConversationStore.getState().addMessage(a, 'assistant', 'b');
    useConversationStore.getState().selectNode(a);
    const state = useConversationStore.getState();
    expect(state.currentNodeId).toBe(a);
    expect(state.currentPath).toEqual([a]);
  });

  it('getCurrentConversation returns correct path nodes', () => {
    const a = useConversationStore.getState().addMessage(null, 'user', 'message a');
    const b = useConversationStore.getState().addMessage(a, 'assistant', 'message b');
    const conversation = useConversationStore.getState().getCurrentConversation();
    expect(conversation).toHaveLength(2);
    expect(conversation[0].content).toBe('message a');
    expect(conversation[1].content).toBe('message b');
  });

  it('clearConversation resets all state', () => {
    useConversationStore.getState().addMessage(null, 'user', 'test');
    useConversationStore.getState().clearConversation();
    const state = useConversationStore.getState();
    expect(state.nodes).toEqual({});
    expect(state.currentNodeId).toBe(null);
    expect(state.currentPath).toEqual([]);
  });

  it('handles branching conversations correctly', () => {
    const root = useConversationStore.getState().addMessage(null, 'user', 'root');
    const branch1 = useConversationStore.getState().addMessage(root, 'assistant', 'branch1');
    useConversationStore.getState().selectNode(root);
    const branch2 = useConversationStore.getState().addMessage(root, 'assistant', 'branch2');
    
    const state = useConversationStore.getState();
    expect(state.nodes[root].children).toHaveLength(2);
    expect(state.nodes[root].children).toContain(branch1);
    expect(state.nodes[root].children).toContain(branch2);
    expect(state.currentNodeId).toBe(branch2);
  });
});
