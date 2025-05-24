import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient, type LLMProvider as APILLMProvider } from '@/lib/api';

export interface LLMProviderConfig {
  type: 'openai' | 'gemini' | 'anthropic' | 'ollama' | 'azure';
  name: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface LLMProvider {
  id: string;
  name: string;
  type: 'openai' | 'gemini' | 'anthropic' | 'ollama' | 'azure';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  enabled: boolean;
}

interface SettingsState {
  isSettingsOpen: boolean;
  providerConfigs: LLMProviderConfig[];
  activeProviders: LLMProvider[];
  activeProviderId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  openSettings: () => void;
  closeSettings: () => void;
  loadProviders: () => Promise<void>;
  updateProviderConfig: (type: LLMProviderConfig['type'], updates: Partial<LLMProviderConfig>) => Promise<void>;
  setActiveProvider: (id: string) => Promise<void>;
  
  // Utility
  convertAPIProvider: (apiProvider: APILLMProvider) => LLMProvider;
  getOrCreateProvider: (config: LLMProviderConfig) => Promise<string>;
  clearLocalStorage: () => void;
}

const defaultProviderConfigs: LLMProviderConfig[] = [
  {
    type: 'openai',
    name: 'OpenAI',
    model: 'gpt-4o',
    enabled: false,
  },
  {
    type: 'azure',
    name: 'Azure OpenAI',
    model: 'gpt-4',
    enabled: false,
  },
  {
    type: 'gemini',
    name: 'Google Gemini',
    model: 'gemini-pro',
    enabled: false,
  },
  {
    type: 'anthropic',
    name: 'Anthropic Claude',
    model: 'claude-3-sonnet-20240229',
    enabled: false,
  },
  {
    type: 'ollama',
    name: 'Ollama (Local)',
    model: 'llama2:latest',
    baseUrl: 'http://localhost:11434',
    enabled: true,
  },
];

const SETTINGS_VERSION = 4; // バージョンを上げて古いデータをリセット

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      isSettingsOpen: false,
      providerConfigs: defaultProviderConfigs,
      activeProviders: [],
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
            activeProviders: providers,
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

      updateProviderConfig: async (type, updates) => {
        set({ isLoading: true, error: null });
        try {
          // ローカル設定を更新
          set((state) => ({
            providerConfigs: state.providerConfigs.map((config) =>
              config.type === type ? { ...config, ...updates } : config
            ),
          }));

          const updatedConfig = get().providerConfigs.find(c => c.type === type);
          if (!updatedConfig) return;

          // 有効になった場合、バックエンドにプロバイダーを作成/更新
          if (updatedConfig.enabled) {
            const providerId = await get().getOrCreateProvider(updatedConfig);
            
            // アクティブプロバイダーを更新
            await get().setActiveProvider(providerId);
          }

          set({ isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update provider config',
            isLoading: false,
          });
        }
      },

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

      getOrCreateProvider: async (config: LLMProviderConfig): Promise<string> => {
        // 既存のプロバイダーを検索
        const existingProvider = get().activeProviders.find(p => p.type === config.type);
        
        if (existingProvider) {
          // 既存プロバイダーを更新
          const updateData: any = {};
          if (config.model) updateData.model_name = config.model;
          if (config.apiKey) updateData.api_key = config.apiKey;
          if (config.baseUrl) updateData.base_url = config.baseUrl;
          
          await apiClient.updateProvider(existingProvider.id, updateData);
          return existingProvider.id;
        } else {
          // 新しいプロバイダーを作成
          const newProvider = await apiClient.createProvider({
            name: config.name,
            provider_type: config.type === 'azure' ? 'openai' : config.type, // Azure は OpenAI として扱う
            model_name: config.model,
            api_key: config.apiKey,
            base_url: config.baseUrl,
          });
          
          const { convertAPIProvider } = get();
          const convertedProvider = convertAPIProvider(newProvider);
          
          set((state) => ({
            activeProviders: [...state.activeProviders, convertedProvider],
          }));
          
          return newProvider.id;
        }
      },

      clearLocalStorage: () => {
        set(state => {
          // @ts-expect-error: persist.clearStorage is not typed
          persist.clearStorage('llm-chat-settings');
          return { ...state, providerConfigs: defaultProviderConfigs, activeProviderId: null };
        });
      },
      convertAPIProvider: (apiProvider: APILLMProvider): LLMProvider => {
        // プロバイダー名からタイプを推定
        const name = apiProvider.name.toLowerCase();
        let type: LLMProvider['type'] = 'ollama'; // デフォルト
        
        if (name.includes('openai') || name.includes('gpt')) {
          type = 'openai';
        } else if (name.includes('azure')) {
          type = 'azure';
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
        providerConfigs: state.providerConfigs,
        activeProviderId: state.activeProviderId,
      }),
      migrate: (persistedState: unknown, version: number) => {
        // バージョンが古い場合はデフォルト設定にリセット
        if (version < SETTINGS_VERSION) {
          return {
            providerConfigs: defaultProviderConfigs,
            activeProviderId: null,
          };
        }
        return persistedState as { 
          providerConfigs: LLMProviderConfig[]; 
          activeProviderId: string | null 
        };
      },
    }
  )
);
