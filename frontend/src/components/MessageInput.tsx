'use client';

import React, { useState } from 'react';
import { useConversationStore } from '@/store/conversationStore';

export const MessageInput: React.FC = () => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { addMessage, currentNodeId } = useConversationStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      // ユーザーメッセージを追加
      const userMessageId = addMessage(currentNodeId, 'user', userMessage);

      // TODO: ここで実際のLLM APIを呼び出す
      // 現在はダミーレスポンスを生成
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
      
      const dummyResponse = `これは「${userMessage}」に対するダミーレスポンスです。実際のLLM統合が完了すると、ここに本物のAI応答が表示されます。`;
      
      // AIレスポンスを追加
      addMessage(userMessageId, 'assistant', dummyResponse);
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      // エラーハンドリング
      addMessage(currentNodeId, 'assistant', 'エラーが発生しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t bg-white p-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力してください..."
          className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={1}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            '送信'
          )}
        </button>
      </form>
    </div>
  );
};
