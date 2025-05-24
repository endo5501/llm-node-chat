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

export interface ConversationTree {
  conversation_id: string;
  messages: Message[];
}

export interface SendMessageRequest {
  conversation_id: string;
  parent_id: string | null;
  content: string;
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
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `HTTP error! status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
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
    return this.request<Conversation[]>('/api/conversations/');
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
    return this.request<ConversationTree>(`/api/conversations/${id}/tree`);
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
      params.append('node_id', nodeId);
    }
    
    const endpoint = `/api/chat/history/${conversationId}${params.toString() ? `?${params.toString()}` : ''}`;
    return this.request<Message[]>(endpoint);
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
