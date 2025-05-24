# システムパターン

## システムアーキテクチャ

本アプリケーションは、フロントエンドとバックエンドに分かれたクライアント・サーバーアーキテクチャを採用しています。

```
╭─React (Next.js)────────╮     HTTP REST API      ╭─FastAPI────────╮
│  React Flow            │◀──────────────────────▶│  LLM Service    │
│  Zustand (state mgmt)  │    (+ WebSocket/SSE)   │  (OpenAI / ...) │
╰──────────────┬────────╯                        ╰────────┬──────╯
               │ localStorage                          │
               ▼                                       ▼
        Settings Storage                        SQLite / PostgreSQL
```

*   **フロントエンド**: Next.js (React) を使用し、UIの描画にはReact Flow、状態管理にはZustand、スタイリングにはTailwind CSS (+ shadcn/ui) を利用します。
*   **バックエンド**: Python (FastAPI) を使用し、LLMサービス（OpenAI、Azure、Anthropic、Gemini、Ollamaなど）との連携を担当します。
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

### API設計パターン（実装完了）

*   **RESTful エンドポイント**:
    - `/api/conversations/`: 会話管理（CRUD + ツリー構造取得）
    - `/api/chat/`: チャット機能（送信、履歴、再生成）
    - `/api/providers/`: LLMプロバイダー管理（設定、切り替え、テスト、アクティブ化）

*   **非同期処理**: FastAPI + SQLAlchemyの非同期機能を活用
*   **エラーハンドリング**: HTTPステータスコードと詳細なエラーメッセージ
*   **CORS設定**: フロントエンド（localhost:3000）からのアクセス許可

### 状態管理パターン（実装完了）

*   **フロントエンド状態管理**:
    - **Zustand**: 会話ノード、設定、UI状態の管理
    - **localStorage**: 設定の永続化（バージョン管理機能付き）
    - **React Flow**: ツリー表示とノード操作の状態管理

*   **プロバイダー設定管理**:
    - **プロバイダータイプベース設定**: 統一インターフェースで5つのプロバイダータイプを管理
    - **ローカル設定とAPI連携**: Zustandによるローカル設定とバックエンドAPIの組み合わせ
    - **設定永続化**: バージョン管理機能付きlocalStorageとデータベースの連携

*   **バックエンド状態管理**:
    - **SQLAlchemy Session**: データベース接続とトランザクション管理
    - **依存性注入**: FastAPIのDependsを使用したリソース管理

### LLMサービス統合パターン（実装完了）

*   **プロバイダー抽象化**:
    ```python
    class LLMService:
        async def generate_response(provider, messages, max_tokens)
        def _get_provider_type(provider) -> str  # 自動判定
        def _format_messages_for_provider(provider_name, messages)
        async def _generate_openai_response(...)  # OpenAI + Azure
        async def _generate_anthropic_response(...)
        async def _generate_gemini_response(...)
        async def _generate_ollama_response(...)
    ```

*   **統一インターフェース**: プロバイダー固有の差異を吸収
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

## コンポーネント間の関係（実装済み）

*   **フロントエンド ↔ バックエンド**: 
    - HTTP REST APIによる基本通信（実装完了）
    - プロバイダー管理APIの完全統合（実装完了）
    - WebSocket/SSEによるリアルタイム通信（今後実装予定）

*   **バックエンド ↔ LLMサービス**: 
    - 統一インターフェースによる5つのプロバイダー対応（実装完了）
    - Azure OpenAI対応（実装完了）
    - 非同期処理による効率的なAPI呼び出し（実装完了）
    - APIキー検証とエラーハンドリング（実装完了）

*   **バックエンド ↔ データベース**: 
    - SQLAlchemyによる非同期ORM操作（実装完了）
    - プロバイダー設定の永続化（実装完了）
    - Alembicによるマイグレーション管理（設定完了）

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

## エラーハンドリングパターン（実装完了）

*   **段階的エラー検証**:
    1. **フロントエンド**: 入力値検証、UI状態管理
    2. **バックエンドAPI**: リクエスト検証、ビジネスロジック検証
    3. **LLMサービス**: APIキー検証、プロバイダー固有エラー処理

*   **ユーザーフレンドリーなエラーメッセージ**:
    - 無効なAPIキー: "Invalid API key for [Provider]. Please set a valid API key in settings."
    - 接続エラー: "申し訳ございません。[Provider]からの応答生成中にエラーが発生しました。"
    - JSON解析エラー: DELETE API 204レスポンスの適切な処理

*   **エラー回復機能**:
    - 設定画面でのエラー表示とリトライ機能
    - ローディング状態の適切な管理
    - 非同期処理のエラーハンドリング

## 設計原則

*   **関心の分離**: フロントエンドとバックエンドの明確な責任分担
*   **拡張性**: 新しいLLMプロバイダーの容易な追加
*   **型安全性**: TypeScript（フロントエンド）とPydantic（バックエンド）による型チェック
*   **非同期処理**: パフォーマンス向上のための非同期パターンの活用
*   **エラー耐性**: 各層でのエラーハンドリングとユーザーフレンドリーなエラー表示
*   **設定管理**: プロバイダータイプベースの統一設定による保守性向上
*   **ユーザビリティ**: 直感的なUI、適切なローディング状態、明確なエラーメッセージ

## 今後の拡張ポイント

*   **リアルタイム通信**: WebSocket/SSEによるストリーミング応答
*   **認証・認可**: ユーザー管理とセキュリティ機能
*   **キャッシュ**: 応答の高速化とコスト削減
*   **監視・ログ**: システムの健全性監視とデバッグ支援
*   **プロバイダー拡張**: 新しいLLMプロバイダーの追加（Claude-3.5、GPT-5等）
*   **設定エクスポート/インポート**: プロバイダー設定のバックアップと復元機能
