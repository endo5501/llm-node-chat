import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient, type LLMProvider as APILLMProvider } from '@/lib/api';

export interface LLMProvider {
  id: string;
  name: string;
  type: 'openai' | 'gemini' | 'anthropic' | 'ollama';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  enabled: boolean;
}

interface SettingsState {
  isSettingsOpen: boolean;
  providers: LLMProvider[];
  activeProviderId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  openSettings: () => void;
  closeSettings: () => void;
  loadProviders: () => Promise<void>;
  updateProvider: (id: string, updates: Partial<LLMProvider>) => Promise<void>;
  addProvider: (provider: Omit<LLMProvider, 'id'>) => Promise<void>;
  removeProvider: (id: string) => void;
  setActiveProvider: (id: string) => Promise<void>;
  
  // Utility
  convertAPIProvider: (apiProvider: APILLMProvider) => LLMProvider;
}

const SETTINGS_VERSION = 3; // バージョンを上げて古いデータをリセット

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      isSettingsOpen: false,
      providers: [],
      activeProviderId: null,
      isLoading: false,
      error: null,

      openSettings: () => {
        set({ isSettingsOpen: true });
        // 設定画面を開く際にプロバイダーを読み込み
        get().loadProviders();
      },
      
      closeSettings: () => set({ isSettingsOpen: false }),

      loadProviders: async () => {
        set({ isLoading: true, error: null });
        try {
          const apiProviders = await apiClient.getProviders();
          const activeProvider = await apiClient.getActiveProvider();
          
          const { convertAPIProvider } = get();
          const providers = apiProviders.map(convertAPIProvider);
          
          set({
            providers,
            activeProviderId: activeProvider?.id || null,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load providers',
            isLoading: false,
          });
        }
      },

      updateProvider: async (id, updates) => {
        set({ isLoading: true, error: null });
        try {
          // バックエンドAPIを更新
          const updateData: any = {};
          if (updates.model) updateData.model_name = updates.model;
          if (updates.apiKey) updateData.api_key = updates.apiKey;
          if (updates.baseUrl) updateData.base_url = updates.baseUrl;
          
          await apiClient.updateProvider(id, updateData);
          
          // ローカル状態を更新
          set((state) => ({
            providers: state.providers.map((provider) =>
              provider.id === id ? { ...provider, ...updates } : provider
            ),
            isLoading: false,
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update provider',
            isLoading: false,
          });
        }
      },

      addProvider: async (provider) => {
        set({ isLoading: true, error: null });
        try {
          const newProvider = await apiClient.createProvider({
            name: provider.name,
            provider_type: provider.type,
            model_name: provider.model || '',
            api_key: provider.apiKey,
            base_url: provider.baseUrl,
          });
          
          const { convertAPIProvider } = get();
          const convertedProvider = convertAPIProvider(newProvider);
          
          set((state) => ({
            providers: [...state.providers, convertedProvider],
            isLoading: false,
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to add provider',
            isLoading: false,
          });
        }
      },

      removeProvider: (id) =>
        set((state) => ({
          providers: state.providers.filter((provider) => provider.id !== id),
          activeProviderId:
            state.activeProviderId === id ? null : state.activeProviderId,
        })),

      setActiveProvider: async (id) => {
        set({ isLoading: true, error: null });
        try {
          await apiClient.activateProvider(id);
          set({ 
            activeProviderId: id,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to activate provider',
            isLoading: false,
          });
        }
      },

      convertAPIProvider: (apiProvider: APILLMProvider): LLMProvider => {
        // プロバイダー名からタイプを推定
        const name = apiProvider.name.toLowerCase();
        let type: LLMProvider['type'] = 'ollama'; // デフォルト
        
        if (name.includes('openai') || name.includes('gpt')) {
          type = 'openai';
        } else if (name.includes('claude') || name.includes('anthropic')) {
          type = 'anthropic';
        } else if (name.includes('gemini') || name.includes('google')) {
          type = 'gemini';
        }

        return {
          id: apiProvider.id,
          name: apiProvider.name,
          type,
          model: apiProvider.model_name,
          apiKey: apiProvider.api_key || undefined,
          baseUrl: apiProvider.base_url || undefined,
          enabled: true, // APIから取得したプロバイダーは有効とみなす
        };
      },
    }),
    {
      name: 'llm-chat-settings',
      version: SETTINGS_VERSION,
      partialize: (state) => ({
        // APIから取得するため、永続化は最小限に
        activeProviderId: state.activeProviderId,
      }),
      migrate: (persistedState: unknown, version: number) => {
        // バージョンが古い場合はデフォルト設定にリセット
        if (version < SETTINGS_VERSION) {
          return {
            activeProviderId: null,
          };
        }
        return persistedState as { activeProviderId: string | null };
      },
    }
  )
);
