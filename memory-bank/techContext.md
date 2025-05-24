# 技術コンテキスト

## 使用技術

### フロントエンド

*   **言語**: TypeScript
*   **フレームワーク**: Next.js
*   **描画ライブラリ**: React Flow
*   **状態管理**: Zustand / Recoil (どちらか、または両方を検討)
*   **スタイリング**: Tailwind CSS (+ shadcn/ui)

### バックエンド

*   **言語/ランタイム**: Python (uv)
*   **Webフレームワーク**: FastAPI
*   **データベースマイグレーション**: Alembic
*   **LLM呼び出し**: OpenAI, Gemini, Claude, Ollamaなど、複数のLLMプロバイダーに対応

### データベース

*   **RDBMS**: PostgreSQL

## 開発セットアップ

*   **ディレクトリ構造**:
    *   `frontend/`: フロントエンド関連の処理を格納します。
    *   `backend/`: バックエンド関連の処理を格納します。

## 技術的制約

*   LLMへの入力は、選択されたノードから根までの会話履歴に限定され、`max_tokens`の制約内でtruncateされる必要があります。
*   リアルタイムなチャット体験を提供するため、フロントエンドとバックエンド間の通信は低遅延である必要があります（WebSocket/SSEの採用）。

## 依存関係

*   フロントエンドはNext.js、React Flow、Zustand/Recoil、Tailwind CSS、shadcn/uiに依存します。
*   バックエンドはFastAPI、Alembic、および各LLMプロバイダーのSDK（例: `openai`ライブラリ）に依存します。
*   データベースはPostgreSQLに依存します。

## ツール使用パターン

*   **開発**: `uv` (Pythonのパッケージ管理・実行ツール) を使用してバックエンドの依存関係を管理し、開発サーバーを起動します。
*   **データベース**: Alembicを使用してデータベーススキーマの変更を適用・管理します。
*   **フロントエンド**: `npm`または`yarn`を使用してフロントエンドの依存関係を管理し、開発サーバーを起動します。
