'use client';

import React, { useState } from 'react';
import { useConversationStore } from '@/store/conversationStore';
import { useSettingsStore } from '@/store/settingsStore';

export const Sidebar: React.FC = () => {
  const { clearConversation } = useConversationStore();
  const { openSettings } = useSettingsStore();
  const [chatHistory] = useState<Array<{ id: string; title: string; lastMessage: string }>>([
    // ダミーデータ - 後でデータベースから取得
    { id: '1', title: 'チャット 1', lastMessage: 'こんにちは' },
    { id: '2', title: 'チャット 2', lastMessage: 'プログラミングについて' },
  ]);

  const handleNewChat = () => {
    clearConversation();
  };

  const handleChatSelect = (chatId: string) => {
    // TODO: 選択されたチャットの履歴を読み込む
    console.log('チャット選択:', chatId);
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
          <div className="space-y-1">
            {chatHistory.map((chat) => (
              <button
                key={chat.id}
                onClick={() => handleChatSelect(chat.id)}
                className="w-full text-left p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              >
                <div className="font-medium text-sm text-gray-800 truncate">
                  {chat.title}
                </div>
                <div className="text-xs text-gray-500 truncate mt-1">
                  {chat.lastMessage}
                </div>
              </button>
            ))}
          </div>
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
