import { beforeEach, describe, expect, it } from 'vitest';
import { useConversationStore } from './conversationStore';

// Helper to reset store before each test
const resetStore = () => {
  const { clearConversation } = useConversationStore.getState();
  clearConversation();
  useConversationStore.setState({
    conversations: [],
    currentConversationId: null,
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
});
