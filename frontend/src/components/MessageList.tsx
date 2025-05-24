'use client';

import React from 'react';
import { useConversationStore, MessageNode } from '@/store/conversationStore';

interface MessageBubbleProps {
  message: MessageNode;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`
          max-w-[70%] px-4 py-2 rounded-lg
          ${isUser 
            ? 'bg-blue-500 text-white rounded-br-sm' 
            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
          }
        `}
      >
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        <div className={`text-xs mt-1 ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
          {message.createdAt.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export const MessageList: React.FC = () => {
  const { getCurrentConversation } = useConversationStore();
  const messages = getCurrentConversation();

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500 bg-gray-100">
          新しい会話を開始してください
        </div>
      ) : (
        messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))
      )}
    </div>
  );
};
