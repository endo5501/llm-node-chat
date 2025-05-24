'use client';

import { Sidebar } from '@/components/Sidebar';
import { MessageList } from '@/components/MessageList';
import { MessageInput } from '@/components/MessageInput';
import { ConversationTree } from '@/components/ConversationTree';

export default function Home() {
  return (
    <div className="flex h-screen">
      {/* 左側サイドバー */}
      <Sidebar />

      {/* メインコンテンツ領域 */}
      <main className="flex-1 flex flex-col">
        {/* チャット領域 */}
        <MessageList />

        {/* テキスト入力エリア */}
        <MessageInput />
      </main>

      {/* ツリー表示領域 */}
      <aside className="w-80 bg-gray-50 border-l border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">会話ツリー</h2>
        </div>
        <div className="h-full">
          <ConversationTree />
        </div>
      </aside>
    </div>
  );
}
