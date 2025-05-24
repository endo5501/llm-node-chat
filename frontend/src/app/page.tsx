export default function Home() {
  return (
    <div className="flex h-screen">
      {/* 左側サイドバー */}
      <aside className="w-64 bg-gray-100 p-4 border-r border-gray-200 flex flex-col">
        <h2 className="text-xl font-bold mb-4">チャット履歴</h2>
        {/* ここにチャット履歴一覧を配置 */}
        <div className="flex-1">
          {/* チャット履歴リストがここに入る */}
        </div>
        <div className="mt-4">
          <button className="w-full bg-blue-500 text-white py-2 px-4 rounded mb-2">
            新規チャット開始
          </button>
          <button className="w-full bg-gray-300 text-gray-800 py-2 px-4 rounded">
            設定
          </button>
        </div>
      </aside>

      {/* メインコンテンツ領域 */}
      <main className="flex-1 flex flex-col">
        {/* チャット領域 */}
        <div className="flex-1 p-4 overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">チャット</h2>
          {/* ここに会話履歴を配置 */}
        </div>

        {/* テキスト入力エリア */}
        <div className="p-4 border-t border-gray-200">
          <input
            type="text"
            placeholder="メッセージを入力..."
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
      </main>

      {/* ツリー表示領域 */}
      <aside className="w-80 bg-gray-100 p-4 border-l border-gray-200">
        <h2 className="text-xl font-bold mb-4">会話ツリー</h2>
        {/* ここにツリー表示を配置 */}
      </aside>
    </div>
  );
}
