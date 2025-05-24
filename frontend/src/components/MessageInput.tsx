'use client';

import React, { useState } from 'react';
import { useConversationStore } from '@/store/conversationStore';

export const MessageInput: React.FC = () => {
  const [input, setInput] = useState('');
  const { 
    sendMessageToAPI, 
    createNewConversation,
    currentNodeId, 
    currentConversationId,
    isLoading,
    error 
  } = useConversationStore();

  console.log('MessageInput rendered, currentNodeId:', currentNodeId);

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('=== handleSubmit called ===');
    e.preventDefault();
    
    console.log('Input value:', input);
    console.log('Is loading:', isLoading);
    
    if (!input.trim() || isLoading) {
      console.log('Early return - empty input or loading');
      return;
    }

    const userMessage = input.trim();
    setInput('');

    try {
      console.log('=== MessageInput API Integration ===');
      console.log('Current conversation ID:', currentConversationId);
      console.log('Current node ID:', currentNodeId);
      console.log('User message:', userMessage);
      
      // 会話が存在しない場合は新規作成
      if (!currentConversationId) {
        console.log('No active conversation, creating new one...');
        await createNewConversation();
      }

      // バックエンドAPIにメッセージを送信
      await sendMessageToAPI(userMessage);
      
      console.log('Message sent successfully to API');
      console.log('=== End MessageInput API Integration ===');
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      // エラーの詳細をログに出力
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      } else {
        console.error('Non-Error object:', error);
      }
      
      // エラー表示（必要に応じてトーストやアラートを追加）
      const errorMessage = error instanceof Error ? error.message : 
                          typeof error === 'string' ? error : 
                          JSON.stringify(error);
      alert(`エラーが発生しました: ${errorMessage}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    console.log('Key pressed:', e.key);
    if (e.key === 'Enter' && !e.shiftKey) {
      console.log('Enter pressed, calling handleSubmit');
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleButtonClick = () => {
    console.log('Button clicked');
    // フォームイベントを作成してhandleSubmitを呼び出す
    const fakeEvent = {
      preventDefault: () => {},
    } as React.FormEvent;
    handleSubmit(fakeEvent);
  };

  return (
    <div className="border-t bg-white p-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => {
            console.log('Input changed:', e.target.value);
            setInput(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力してください..."
          className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
          rows={1}
          disabled={isLoading}
        />
        <button
          type="button"
          onClick={handleButtonClick}
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
