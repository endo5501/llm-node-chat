import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LLMProvider {
  id: string;
  name: string;
  type: 'openai' | 'gemini' | 'claude' | 'ollama' | 'azure';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  enabled: boolean;
}

interface SettingsState {
  isSettingsOpen: boolean;
  providers: LLMProvider[];
  activeProviderId: string | null;
  
  // Actions
  openSettings: () => void;
  closeSettings: () => void;
  updateProvider: (id: string, updates: Partial<LLMProvider>) => void;
  addProvider: (provider: Omit<LLMProvider, 'id'>) => void;
  removeProvider: (id: string) => void;
  setActiveProvider: (id: string) => void;
}

const defaultProviders: LLMProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    model: 'gpt-4',
    enabled: false,
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    type: 'azure',
    model: 'gpt-4',
    enabled: false,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    type: 'gemini',
    model: 'gemini-pro',
    enabled: false,
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    type: 'claude',
    model: 'claude-3-sonnet-20240229',
    enabled: false,
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    type: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama2',
    enabled: false,
  },
];

const SETTINGS_VERSION = 2; // バージョンを上げて古いデータをリセット

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isSettingsOpen: false,
      providers: defaultProviders,
      activeProviderId: null,

      openSettings: () => set({ isSettingsOpen: true }),
      closeSettings: () => set({ isSettingsOpen: false }),

      updateProvider: (id, updates) =>
        set((state) => ({
          providers: state.providers.map((provider) =>
            provider.id === id ? { ...provider, ...updates } : provider
          ),
        })),

      addProvider: (provider) =>
        set((state) => ({
          providers: [
            ...state.providers,
            { ...provider, id: `custom-${Date.now()}` },
          ],
        })),

      removeProvider: (id) =>
        set((state) => ({
          providers: state.providers.filter((provider) => provider.id !== id),
          activeProviderId:
            state.activeProviderId === id ? null : state.activeProviderId,
        })),

      setActiveProvider: (id) => set({ activeProviderId: id }),
    }),
    {
      name: 'llm-chat-settings',
      version: SETTINGS_VERSION,
      partialize: (state) => ({
        providers: state.providers,
        activeProviderId: state.activeProviderId,
      }),
      migrate: (persistedState: unknown, version: number) => {
        // バージョンが古い場合はデフォルト設定にリセット
        if (version < SETTINGS_VERSION) {
          return {
            providers: defaultProviders,
            activeProviderId: null,
          };
        }
        return persistedState as { providers: LLMProvider[]; activeProviderId: string | null };
      },
    }
  )
);
