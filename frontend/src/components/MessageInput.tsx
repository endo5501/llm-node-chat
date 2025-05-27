'use client';

import React, { useState, useEffect } from 'react';
import { useConversationStore } from '@/store/conversationStore';

export const MessageInput: React.FC = () => {
  const [input, setInput] = useState('');
  const [useWebSocket, setUseWebSocket] = useState(true);
  
  const { 
    sendMessageToAPI,
    sendMessageViaWebSocket,
    initializeWebSocket,
    createNewConversation,
    currentNodeId, 
    currentConversationId,
    isLoading,
    isStreaming,
    isWebSocketConnected,
    error 
  } = useConversationStore();

  // WebSocket接続を初期化
  useEffect(() => {
    if (useWebSocket && !isWebSocketConnected) {
      initializeWebSocket().catch(console.error);
    }
  }, [useWebSocket, isWebSocketConnected, initializeWebSocket]);

  console.log('MessageInput rendered, currentNodeId:', currentNodeId);

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('=== handleSubmit called ===');
    e.preventDefault();
    
    console.log('Input value:', input);
    console.log('Is loading:', isLoading);
    console.log('Is streaming:', isStreaming);
    
    if (!input.trim() || isLoading || isStreaming) {
      console.log('Early return - empty input, loading, or streaming');
      return;
    }

    const userMessage = input.trim();
    setInput('');

    try {
      console.log('=== MessageInput Integration ===');
      console.log('Current conversation ID:', currentConversationId);
      console.log('Current node ID:', currentNodeId);
      console.log('User message:', userMessage);
      console.log('Use WebSocket:', useWebSocket);
      console.log('WebSocket connected:', isWebSocketConnected);
      
      // 会話が存在しない場合は新規作成
      if (!currentConversationId) {
        console.log('No active conversation, creating new one...');
        await createNewConversation();
      }

      // WebSocketまたはHTTP APIでメッセージを送信
      if (useWebSocket && isWebSocketConnected) {
        console.log('Sending message via WebSocket...');
        await sendMessageViaWebSocket(userMessage);
      } else {
        console.log('Sending message via HTTP API...');
        await sendMessageToAPI(userMessage);
      }
      
      console.log('Message sent successfully');
      console.log('=== End MessageInput Integration ===');
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
      {/* 接続状態とモード切り替え */}
      <div className="flex items-center justify-between mb-2 text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">通信モード:</span>
            <button
              onClick={() => setUseWebSocket(!useWebSocket)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                useWebSocket 
                  ? 'bg-green-100 text-green-800 border border-green-300' 
                  : 'bg-gray-100 text-gray-800 border border-gray-300'
              }`}
            >
              {useWebSocket ? 'WebSocket (ストリーミング)' : 'HTTP API'}
            </button>
          </div>
          
          {useWebSocket && (
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                isWebSocketConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className={`text-xs ${
                isWebSocketConnected ? 'text-green-600' : 'text-red-600'
              }`}>
                {isWebSocketConnected ? '接続済み' : '未接続'}
              </span>
            </div>
          )}
        </div>

        {isStreaming && (
          <div className="flex items-center gap-2 text-blue-600">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-xs">ストリーミング中...</span>
          </div>
        )}
      </div>

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
          disabled={isLoading || isStreaming}
        />
        <button
          type="button"
          onClick={handleButtonClick}
          disabled={!input.trim() || isLoading || isStreaming}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {isLoading || isStreaming ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            '送信'
          )}
        </button>
      </form>
    </div>
  );
};
