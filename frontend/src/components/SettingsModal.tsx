'use client';

import React, { useState } from 'react';
import { useSettingsStore, LLMProvider } from '@/store/settingsStore';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    providers,
    activeProviderId,
    closeSettings,
    updateProvider,
    setActiveProvider,
  } = useSettingsStore();

  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<LLMProvider>>({});

  if (!isSettingsOpen) return null;

  const handleEditProvider = (provider: LLMProvider) => {
    setEditingProvider(provider.id);
    setFormData(provider);
  };

  const handleSaveProvider = () => {
    if (editingProvider && formData) {
      updateProvider(editingProvider, formData);
      setEditingProvider(null);
      setFormData({});
    }
  };

  const handleCancelEdit = () => {
    setEditingProvider(null);
    setFormData({});
  };

  const handleInputChange = (field: keyof LLMProvider, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getProviderIcon = (type: LLMProvider['type']) => {
    switch (type) {
      case 'openai':
        return '🤖';
      case 'azure':
        return '☁️';
      case 'gemini':
        return '💎';
      case 'claude':
        return '🧠';
      case 'ollama':
        return '🦙';
      default:
        return '⚙️';
    }
  };

  const needsApiKey = (type: LLMProvider['type']) => {
    return type !== 'ollama';
  };

  const needsBaseUrl = (type: LLMProvider['type']) => {
    return type === 'ollama' || type === 'azure';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">設定</h2>
          <button
            onClick={closeSettings}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-6">
            {/* アクティブプロバイダー選択 */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">アクティブなLLMプロバイダー</h3>
              <div className="space-y-2">
                {providers.filter(p => p.enabled).map((provider) => (
                  <label
                    key={provider.id}
                    className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      activeProviderId === provider.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="activeProvider"
                      value={provider.id}
                      checked={activeProviderId === provider.id}
                      onChange={() => setActiveProvider(provider.id)}
                      className="mr-3 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{getProviderIcon(provider.type)}</span>
                      <div>
                        <div className="font-medium text-gray-800">{provider.name}</div>
                        <div className="text-sm text-gray-500">{provider.model}</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              {providers.filter(p => p.enabled).length === 0 && (
                <p className="text-gray-500 text-sm">有効なプロバイダーがありません。下記でプロバイダーを設定してください。</p>
              )}
            </div>

            {/* プロバイダー設定 */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">LLMプロバイダー設定</h3>
              <div className="space-y-4">
                {providers.map((provider) => (
                  <div key={provider.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-xl">{getProviderIcon(provider.type)}</span>
                        <div>
                          <h4 className="font-medium text-gray-800">{provider.name}</h4>
                          <p className="text-sm text-gray-500">{provider.model}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={provider.enabled}
                            onChange={(e) => updateProvider(provider.id, { enabled: e.target.checked })}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-600">有効</span>
                        </label>
                        <button
                          onClick={() => handleEditProvider(provider)}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          編集
                        </button>
                      </div>
                    </div>

                    {editingProvider === provider.id && (
                      <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            プロバイダー名
                          </label>
                          <input
                            type="text"
                            value={formData.name || ''}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            モデル
                          </label>
                          <input
                            type="text"
                            value={formData.model || ''}
                            onChange={(e) => handleInputChange('model', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {needsApiKey(provider.type) && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              APIキー
                            </label>
                            <input
                              type="password"
                              value={formData.apiKey || ''}
                              onChange={(e) => handleInputChange('apiKey', e.target.value)}
                              placeholder="APIキーを入力してください"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}

                        {needsBaseUrl(provider.type) && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              ベースURL
                            </label>
                            <input
                              type="url"
                              value={formData.baseUrl || ''}
                              onChange={(e) => handleInputChange('baseUrl', e.target.value)}
                              placeholder={
                                provider.type === 'azure' 
                                  ? "https://your-resource.openai.azure.com/"
                                  : "http://localhost:11434"
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}

                        <div className="flex space-x-2 pt-2">
                          <button
                            onClick={handleSaveProvider}
                            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
                          >
                            保存
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
