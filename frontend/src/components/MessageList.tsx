'use client';

import React, { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useConversationStore, MessageNode } from '@/store/conversationStore';

interface MessageBubbleProps {
  message: MessageNode;
  isStreaming?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isStreaming = false }) => {
  const t = useTranslations('messageList');
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`
          max-w-[70%] px-4 py-2 rounded-lg relative
          ${isUser 
            ? 'bg-blue-500 text-white rounded-br-sm' 
            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
          }
          ${isStreaming ? 'border-2 border-blue-300 animate-pulse' : ''}
        `}
      >
        <div className="text-sm whitespace-pre-wrap">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse" />
          )}
        </div>
        <div className={`text-xs mt-1 flex items-center gap-2 ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
          <span>{message.createdAt.toLocaleTimeString()}</span>
          {isStreaming && (
            <span className="text-blue-500 text-xs flex items-center gap-1">
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" />
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <span>{t('typing')}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const MessageList: React.FC = () => {
  const t = useTranslations('messageList');
  const { getCurrentConversation, isStreaming, streamingNodeId } = useConversationStore();
  const messages = getCurrentConversation();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // メッセージが更新されたときに自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500 bg-gray-100">
          {t('startNewConversation')}
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <MessageBubble 
              key={message.id} 
              message={message} 
              isStreaming={isStreaming && streamingNodeId === message.id}
            />
          ))}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
};
