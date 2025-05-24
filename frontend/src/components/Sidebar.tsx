'use client';

import React, { useEffect, useState } from 'react';
import { useConversationStore } from '@/store/conversationStore';
import { useSettingsStore } from '@/store/settingsStore';

export const Sidebar: React.FC = () => {
  const [isMounted, setIsMounted] = useState(false);
  const { 
    conversations,
    currentConversationId,
    createNewConversation,
    loadConversations,
    loadConversationTree,
    deleteConversation,
    clearConversation,
    isLoading 
  } = useConversationStore();
  const { openSettings } = useSettingsStore();

  // マウント状態を管理
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // マウント後に会話一覧を読み込み
  useEffect(() => {
    if (!isMounted) {
      return;
    }
    
    loadConversations().catch(console.error);
  }, [isMounted, loadConversations]);

  // マウント前は何も表示しない
  if (!isMounted) {
    return (
      <div className="w-64 bg-gray-50 border-r border-gray-200 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const handleNewChat = async () => {
    try {
      await createNewConversation();
      // 新規作成後に会話一覧を再読み込み
      await loadConversations();
    } catch (error) {
      console.error('新規チャット作成エラー:', error);
      alert('新規チャットの作成に失敗しました');
    }
  };

  const handleChatSelect = async (chatId: string) => {
    try {
      await loadConversationTree(chatId);
    } catch (error) {
      console.error('チャット読み込みエラー:', error);
      alert('チャットの読み込みに失敗しました');
    }
  };

  const handleChatDelete = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 親のクリックイベントを防ぐ
    
    if (!confirm('このチャットを削除しますか？')) {
      return;
    }

    try {
      await deleteConversation(chatId);
      // 削除後に会話一覧を再読み込み
      await loadConversations();
    } catch (error) {
      console.error('チャット削除エラー:', error);
      alert('チャットの削除に失敗しました');
    }
  };

  const handleSettings = () => {
    openSettings();
  };

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* ヘッダー */}
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-800">LLM Chat</h1>
      </div>

      {/* チャット履歴 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <h2 className="text-sm font-medium text-gray-600 mb-2 px-2">チャット履歴</h2>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`relative group rounded-lg transition-colors duration-200 ${
                    currentConversationId === conversation.id 
                      ? 'bg-blue-100 border border-blue-300' 
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <button
                    onClick={() => handleChatSelect(conversation.id)}
                    className="w-full text-left p-2 rounded-lg"
                  >
                    <div className="font-medium text-sm text-gray-800 truncate pr-8">
                      {conversation.title}
                    </div>
                    <div className="text-xs text-gray-500 truncate mt-1">
                      {new Date(conversation.updated_at).toLocaleDateString('ja-JP')}
                    </div>
                  </button>
                  
                  {/* 削除ボタン */}
                  <button
                    onClick={(e) => handleChatDelete(conversation.id, e)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded hover:bg-red-100 text-red-500"
                    title="削除"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              
              {conversations.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  チャット履歴がありません
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* フッター */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <button
          onClick={handleNewChat}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-sm font-medium"
        >
          新規チャット
        </button>
        <button
          onClick={handleSettings}
          className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 text-sm font-medium"
        >
          設定
        </button>
      </div>
    </div>
  );
};
