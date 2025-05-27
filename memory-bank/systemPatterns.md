# システムパターン

## システムアーキテクチャ

本アプリケーションは、フロントエンドとバックエンドに分かれたクライアント・サーバーアーキテクチャを採用しています。

```
╭─React (Next.js)────────╮     HTTP REST API      ╭─FastAPI────────╮
│  React Flow            │◀──────────────────────▶│  LLM Service    │
│  Zustand (state mgmt)  │    + WebSocket/SSE     │  (OpenAI / ...) │
│  WebSocket Client      │◀──────────────────────▶│  WebSocket      │
╰──────────────┬────────╯                        ╰────────┬──────╯
               │ localStorage                          │
               ▼                                       ▼
        Settings Storage                        SQLite / PostgreSQL
```

*   **フロントエンド**: Next.js (React) を使用し、UIの描画にはReact Flow、状態管理にはZustand、スタイリングにはTailwind CSS (+ shadcn/ui) を利用します。
*   **バックエンド**: Python (FastAPI) を使用し、LLMサービス（OpenAI、Azure、Anthropic、Gemini、Ollamaなど）との連携を担当します。
*   **リアルタイム通信**: WebSocketによるストリーミング応答とリアルタイム通信を実装。
*   **データベース**: 開発環境ではSQLite、本番環境ではPostgreSQLを使用し、会話履歴やブランチ情報を永続化します。

## 実装済みの技術的決定とデザインパターン

### 会話ブランチのロジック（実装完了）

*   **データベース構造**:
    ```sql
    -- 会話セッション
    conversations (
        id INTEGER PRIMARY KEY,
        title VARCHAR(255),
        created_at DATETIME,
        updated_at DATETIME
    )
    
    -- メッセージとツリー構造
    messages (
        id INTEGER PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id),
        parent_id INTEGER REFERENCES messages(id), -- NULLならroot
        role VARCHAR(20), -- user/assistant/system
        content TEXT,
        created_at DATETIME
    )
    
    -- LLMプロバイダー設定
    llm_providers (
        id INTEGER PRIMARY KEY,
        name VARCHAR(50) UNIQUE,
        provider_type VARCHAR(20), -- openai/anthropic/gemini/ollama
        api_key VARCHAR(255),
        api_url VARCHAR(255), -- Ollama/Azure用
        model_name VARCHAR(100),
        is_active BOOLEAN,
        created_at DATETIME,
        updated_at DATETIME
    )
    ```

*   **ブランチ選択ロジック**:
    1. 選択されたノードから根まで`parent_id`をたどって逆順に並べる
    2. `max_tokens`を超えないように古いメッセージからtruncateする
    3. その配列のみをLLMに投げる

*   **新しい分岐の作成**:
    - 現在選択されているノードを親として新しいメッセージをINSERT
    - どの枝からでも無限に分岐可能（Gitの`checkout -b`のような挙動）

### WebSocket通信パターン（実装完了）

*   **WebSocketエンドポイント**:
    ```python
    @router.websocket("/ws/{client_id}")
    async def websocket_endpoint(websocket: WebSocket, client_id: str):
        await manager.connect(websocket, client_id)
        # メッセージタイプベースのルーティング
        # リアルタイムストリーミング応答
    ```

*   **接続管理パターン**:
    ```python
    class ConnectionManager:
        def __init__(self):
            self.active_connections: Dict[str, WebSocket] = {}
        
        async def connect(self, websocket: WebSocket, client_id: str)
        def disconnect(self, client_id: str)
        async def send_json_message(self, data: dict, client_id: str)
    ```

*   **メッセージタイプ**:
    - `chat_message`: チャットメッセージ送信
    - `user_message`: ユーザーメッセージ確認
    - `assistant_message_start`: アシスタント応答開始
    - `assistant_message_chunk`: ストリーミングチャンク
    - `assistant_message_complete`: アシスタント応答完了
    - `error`: エラーメッセージ
    - `ping`/`pong`: 接続確認

### ストリーミング応答パターン（実装完了）

*   **統一ストリーミングインターフェース**:
    ```python
    async def generate_streaming_response(
        self,
        provider: LLMProvider,
        messages: List[MessageResponse],
        max_tokens: int = 2000
    ) -> AsyncGenerator[str, None]:
        # プロバイダー別ストリーミング実装の抽象化
    ```

*   **プロバイダー別ストリーミング実装**:
    - **OpenAI**: `stream=True`によるネイティブストリーミング
    - **Anthropic**: `client.messages.stream`によるネイティブストリーミング
    - **Gemini**: 単語分割による疑似ストリーミング（`await asyncio.sleep(0.05)`）
    - **Ollama**: `stream=True`によるネイティブストリーミング

*   **ストリーミングフロー**:
    1. WebSocketでメッセージ受信
    2. ユーザーメッセージをデータベースに保存
    3. `assistant_message_start`を送信
    4. LLMストリーミング応答を`assistant_message_chunk`で逐次送信
    5. 完了時に`assistant_message_complete`とデータベース保存

### フロントエンドWebSocketクライアントパターン（実装完了）

*   **WebSocketクライアント設計**:
    ```typescript
    export class WebSocketClient {
      private ws: WebSocket | null = null;
      private messageHandlers: Map<string, (data: any) => void> = new Map();
      
      connect(): Promise<void>
      disconnect(): void
      onMessage(type: string, handler: (data: any) => void)
      sendMessage(message: WebSocketMessage): boolean
    }
    ```

*   **自動再接続パターン**:
    ```typescript
    // 接続断時の自動再接続
    this.ws.onclose = (event) => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => {
          this.connect().catch(console.error);
        }, this.reconnectDelay * this.reconnectAttempts);
      }
    };
    ```

*   **状態管理統合**:
    ```typescript
    // Zustandストアとの統合
    sendMessageViaWebSocket: async (content: string) => {
      const wsClient = getWebSocketClient();
      // ストリーミング状態管理
      // リアルタイムUI更新
    }
    ```

### リアルタイムUI更新パターン（実装完了）

*   **ストリーミング状態管理**:
    ```typescript
    interface ConversationState {
      isStreaming: boolean;
      streamingNodeId: string | null;
      isWebSocketConnected: boolean;
    }
    ```

*   **リアルタイムメッセージ更新**:
    ```typescript
    wsClient.onMessage('assistant_message_chunk', (data: any) => {
      streamingContent += data.chunk;
      // Zustandストアの即座更新
      set((state) => {
        const newNodes = { ...state.nodes };
        if (newNodes[assistantNodeId]) {
          newNodes[assistantNodeId] = {
            ...newNodes[assistantNodeId],
            content: streamingContent,
          };
        }
        return { nodes: newNodes };
      });
    });
    ```

*   **視覚的フィードバック**:
    - ストリーミング中のメッセージ強調表示（`border-2 border-blue-300 animate-pulse`）
    - 入力中アニメーション（点滅カーソル、バウンスドット）
    - 接続状態インジケーター（緑/赤ドット）
    - 自動スクロール機能

### API設計パターン（実装完了）

*   **RESTful エンドポイント**:
    - `/api/conversations/`: 会話管理（CRUD + ツリー構造取得）
    - `/api/chat/`: チャット機能（送信、履歴、再生成）
    - `/api/providers/`: LLMプロバイダー管理（設定、切り替え、テスト、アクティブ化）
    - `/api/websocket/ws/{client_id}`: WebSocket通信エンドポイント

*   **非同期処理**: FastAPI + SQLAlchemyの非同期機能を活用
*   **エラーハンドリング**: HTTPステータスコードと詳細なエラーメッセージ
*   **CORS設定**: フロントエンド（localhost:3000）からのアクセス許可

### 状態管理パターン（実装完了）

*   **フロントエンド状態管理**:
    - **Zustand**: 会話ノード、設定、UI状態、WebSocket状態の管理
    - **localStorage**: 設定の永続化（バージョン管理機能付き）
    - **React Flow**: ツリー表示とノード操作の状態管理

*   **プロバイダー設定管理**:
    - **プロバイダータイプベース設定**: 統一インターフェースで5つのプロバイダータイプを管理
    - **ローカル設定とAPI連携**: Zustandによるローカル設定とバックエンドAPIの組み合わせ
    - **設定永続化**: バージョン管理機能付きlocalStorageとデータベースの連携

*   **バックエンド状態管理**:
    - **SQLAlchemy Session**: データベース接続とトランザクション管理
    - **依存性注入**: FastAPIのDependsを使用したリソース管理
    - **WebSocket接続管理**: ConnectionManagerによる複数クライアント管理

### LLMサービス統合パターン（実装完了）

*   **プロバイダー抽象化**:
    ```python
    class LLMService:
        async def generate_response(provider, messages, max_tokens)
        async def generate_streaming_response(provider, messages, max_tokens)
        def _get_provider_type(provider) -> str  # 自動判定
        def _format_messages_for_provider(provider_name, messages)
        async def _generate_openai_response(...)  # OpenAI + Azure
        async def _generate_openai_streaming_response(...)
        async def _generate_anthropic_response(...)
        async def _generate_anthropic_streaming_response(...)
        async def _generate_gemini_response(...)
        async def _generate_gemini_streaming_response(...)
        async def _generate_ollama_response(...)
        async def _generate_ollama_streaming_response(...)
    ```

*   **統一インターフェース**: プロバイダー固有の差異を吸収
*   **ストリーミング対応**: 全プロバイダーでのストリーミング応答実装
*   **Azure OpenAI対応**: OpenAI APIと同じ処理で実装
*   **APIキー検証**: 無効なキーの検出と適切なエラーメッセージ
*   **クライアントキャッシュ**: プロバイダーごとのクライアント管理
*   **エラーハンドリング**: プロバイダー別のエラー処理とフォールバック

### 設定画面パターン（実装完了）

*   **プロバイダータイプベース設計**:
    ```typescript
    interface LLMProviderConfig {
      type: 'openai' | 'gemini' | 'anthropic' | 'ollama' | 'azure';
      name: string;
      model: string;
      apiKey?: string;
      baseUrl?: string;
      enabled: boolean;
    }
    ```

*   **統一設定インターフェース**:
    - 🤖 OpenAI (gpt-4o)
    - ☁️ Azure OpenAI (gpt-4)
    - 💎 Google Gemini (gemini-pro)
    - 🧠 Anthropic Claude (claude-3-sonnet-20240229)
    - 🦙 Ollama (llama2:latest)

*   **設定管理フロー**:
    1. ローカル設定の更新（Zustand）
    2. バックエンドAPIでプロバイダー作成/更新
    3. アクティブプロバイダーの自動切り替え
    4. 設定の永続化（localStorage + Database）

### 通信モード切り替えパターン（実装完了）

*   **デュアル通信システム**:
    ```typescript
    // WebSocketまたはHTTP APIでメッセージを送信
    if (useWebSocket && isWebSocketConnected) {
      await sendMessageViaWebSocket(userMessage);
    } else {
      await sendMessageToAPI(userMessage);
    }
    ```

*   **フォールバック機能**:
    - WebSocket接続失敗時のHTTP API自動切り替え
    - 接続状態の視覚的表示
    - ユーザーによる手動切り替え機能

*   **UI状態管理**:
    - 通信モード切り替えボタン
    - 接続状態インジケーター
    - ストリーミング状態表示

## コンポーネント間の関係（実装済み）

*   **フロントエンド ↔ バックエンド**: 
    - HTTP REST APIによる基本通信（実装完了）
    - WebSocketによるリアルタイム通信（実装完了）
    - プロバイダー管理APIの完全統合（実装完了）

*   **バックエンド ↔ LLMサービス**: 
    - 統一インターフェースによる5つのプロバイダー対応（実装完了）
    - ストリーミング応答対応（実装完了）
    - Azure OpenAI対応（実装完了）
    - 非同期処理による効率的なAPI呼び出し（実装完了）
    - APIキー検証とエラーハンドリング（実装完了）

*   **バックエンド ↔ データベース**: 
    - SQLAlchemyによる非同期ORM操作（実装完了）
    - プロバイダー設定の永続化（実装完了）
    - Alembicによるマイグレーション管理（設定完了）

*   **WebSocket ↔ UI**: 
    - リアルタイムメッセージ更新（実装完了）
    - ストリーミング状態の視覚的フィードバック（実装完了）
    - 自動スクロール機能（実装完了）

## 重要な実装パス（完了済み）

*   **メッセージの保存と取得**: 
    - 親子関係を持つメッセージの正確な保存
    - 選択されたブランチに基づく会話履歴の効率的な取得
    - ツリー構造の再帰的な構築

*   **ツリー構造の構築と表示**: 
    - データベースから取得した`parent_id`情報を用いたツリー再構築
    - React Flowによる視覚的なツリー表現
    - ノード選択とブランチ切り替えの実装

*   **LLMコンテキスト管理**: 
    - 選択されたブランチのコンテキスト抽出
    - `max_tokens`制約内でのメッセージtruncate
    - プロバイダー固有のメッセージフォーマット変換

*   **プロバイダー管理システム**:
    - プロバイダータイプベースの統一設定
    - WebUIからのリアルタイム切り替え
    - APIキー検証と適切なエラーメッセージ
    - 設定の永続化とAPI連携

*   **WebSocket通信システム**:
    - 接続管理とメッセージルーティング
    - ストリーミング応答の配信
    - 自動再接続機能
    - エラーハンドリングとフォールバック

*   **リアルタイムUI更新**:
    - ストリーミング中の視覚的フィードバック
    - 自動スクロール機能
    - 接続状態表示
    - 通信モード切り替え

## エラーハンドリングパターン（実装完了）

*   **段階的エラー検証**:
    1. **フロントエンド**: 入力値検証、UI状態管理、WebSocket接続状態管理
    2. **バックエンドAPI**: リクエスト検証、ビジネスロジック検証
    3. **WebSocket**: 接続エラー、メッセージ処理エラー
    4. **LLMサービス**: APIキー検証、プロバイダー固有エラー処理

*   **ユーザーフレンドリーなエラーメッセージ**:
    - 無効なAPIキー: "Invalid API key for [Provider]. Please set a valid API key in settings."
    - 接続エラー: "申し訳ございません。[Provider]からの応答生成中にエラーが発生しました。"
    - WebSocket接続エラー: "WebSocket接続に失敗しました。HTTP APIに切り替えます。"
    - JSON解析エラー: DELETE API 204レスポンスの適切な処理

*   **エラー回復機能**:
    - 設定画面でのエラー表示とリトライ機能
    - WebSocket自動再接続機能
    - HTTP APIへのフォールバック
    - ローディング状態の適切な管理
    - 非同期処理のエラーハンドリング

## 設計原則

*   **関心の分離**: フロントエンドとバックエンドの明確な責任分担
*   **拡張性**: 新しいLLMプロバイダーの容易な追加
*   **型安全性**: TypeScript（フロントエンド）とPydantic（バックエンド）による型チェック
*   **非同期処理**: パフォーマンス向上のための非同期パターンの活用
*   **リアルタイム性**: WebSocketによる即座な応答とストリーミング表示
*   **エラー耐性**: 各層でのエラーハンドリングとユーザーフレンドリーなエラー表示
*   **設定管理**: プロバイダータイプベースの統一設定による保守性向上
*   **ユーザビリティ**: 直感的なUI、適切なローディング状態、明確なエラーメッセージ
*   **堅牢性**: 自動再接続、フォールバック機能による安定性確保

## 今後の拡張ポイント

*   **認証・認可**: ユーザー管理とセキュリティ機能
*   **キャッシュ**: 応答の高速化とコスト削減
*   **監視・ログ**: システムの健全性監視とデバッグ支援
*   **プロバイダー拡張**: 新しいLLMプロバイダーの追加（Claude-3.5、GPT-5等）
*   **設定エクスポート/インポート**: プロバイダー設定のバックアップと復元機能
*   **パフォーマンス最適化**: WebSocket接続プーリング、メッセージ圧縮
*   **多言語対応**: 国際化とローカライゼーション
*   **テーマシステム**: ダークモード、カスタムテーマ対応
