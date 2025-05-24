// API client for backend communication

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Message {
  id: string;
  parent_id: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface MessageTreeNode {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  children: MessageTreeNode[];
}

export interface ConversationTree {
  conversation_id: string;
  title: string;
  root_messages: MessageTreeNode[];
}

export interface SendMessageRequest {
  conversation_id: string;
  parent_id: string | null;
  message: string;
}

export interface SendMessageResponse {
  user_message: Message;
  assistant_message: Message;
}

export interface LLMProvider {
  id: string;
  name: string;
  provider_type: 'openai' | 'anthropic' | 'gemini' | 'ollama';
  api_key?: string;
  base_url?: string;
  model_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    console.log(`[API] Making request to: ${url}`);
    console.log(`[API] Request options:`, options);
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      console.log(`[API] Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[API] Error response:`, errorData);
        throw new Error(
          errorData.detail || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();
      console.log(`[API] Response data:`, data);
      return data;
    } catch (error) {
      console.error(`[API] Request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Conversation management
  async createConversation(title?: string): Promise<Conversation> {
    return this.request<Conversation>('/api/conversations/', {
      method: 'POST',
      body: JSON.stringify({ title: title || 'New Conversation' }),
    });
  }

  async getConversations(): Promise<Conversation[]> {
    const conversations = await this.request<any[]>('/api/conversations/');
    // IDを文字列に変換
    return conversations.map(conv => ({
      ...conv,
      id: conv.id.toString()
    }));
  }

  async getConversation(id: string): Promise<Conversation> {
    return this.request<Conversation>(`/api/conversations/${id}`);
  }

  async deleteConversation(id: string): Promise<void> {
    return this.request<void>(`/api/conversations/${id}`, {
      method: 'DELETE',
    });
  }

  async updateConversationTitle(id: string, title: string): Promise<Conversation> {
    return this.request<Conversation>(`/api/conversations/${id}/title`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    });
  }

  async getConversationTree(id: string): Promise<ConversationTree> {
    const tree = await this.request<any>(`/api/conversations/${id}/tree`);
    
    // IDを文字列に変換する再帰関数
    const convertNodeIds = (node: any): MessageTreeNode => ({
      ...node,
      id: node.id.toString(),
      children: node.children.map(convertNodeIds)
    });
    
    return {
      ...tree,
      conversation_id: tree.conversation_id.toString(),
      root_messages: tree.root_messages.map(convertNodeIds)
    };
  }

  // Chat functionality
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    return this.request<SendMessageResponse>('/api/chat/send', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getChatHistory(conversationId: string, nodeId?: string): Promise<Message[]> {
    const params = new URLSearchParams();
    if (nodeId) {
      params.append('from_message_id', nodeId);
    }
    
    const endpoint = `/api/chat/history/${conversationId}${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.request<{ conversation_id: number; messages: Message[] }>(endpoint);
    return response.messages;
  }

  async regenerateResponse(messageId: string): Promise<Message> {
    return this.request<Message>(`/api/chat/regenerate/${messageId}`, {
      method: 'POST',
    });
  }

  // LLM Provider management
  async createProvider(provider: Omit<LLMProvider, 'id' | 'created_at' | 'updated_at' | 'is_active'>): Promise<LLMProvider> {
    return this.request<LLMProvider>('/api/providers/', {
      method: 'POST',
      body: JSON.stringify(provider),
    });
  }

  async getProviders(): Promise<LLMProvider[]> {
    return this.request<LLMProvider[]>('/api/providers/');
  }

  async getActiveProvider(): Promise<LLMProvider | null> {
    try {
      return await this.request<LLMProvider>('/api/providers/active');
    } catch (error) {
      // No active provider found
      return null;
    }
  }

  async updateProvider(id: string, provider: Partial<LLMProvider>): Promise<LLMProvider> {
    return this.request<LLMProvider>(`/api/providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(provider),
    });
  }

  async activateProvider(id: string): Promise<LLMProvider> {
    return this.request<LLMProvider>(`/api/providers/${id}/activate`, {
      method: 'POST',
    });
  }

  async testProvider(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/providers/test/${id}`, {
      method: 'POST',
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/health');
  }
}

export const apiClient = new ApiClient();
