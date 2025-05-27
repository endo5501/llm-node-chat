from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, List
import json
import asyncio
from datetime import datetime

from ..database import get_db
from ..models import Conversation, Message, LLMProvider
from ..schemas import MessageResponse
from ..llm_service import llm_service

router = APIRouter()


class ConnectionManager:
    """WebSocket接続を管理するクラス"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """WebSocket接続を受け入れ"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
    
    def disconnect(self, client_id: str):
        """WebSocket接続を切断"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
    
    async def send_personal_message(self, message: str, client_id: str):
        """特定のクライアントにメッセージを送信"""
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            await websocket.send_text(message)
    
    async def send_json_message(self, data: dict, client_id: str):
        """特定のクライアントにJSONメッセージを送信"""
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            await websocket.send_json(data)


manager = ConnectionManager()


async def get_conversation_history(
    conversation_id: int,
    parent_id: int = None,
    db: AsyncSession = None
) -> List[MessageResponse]:
    """指定されたノードから根までの会話履歴を取得"""
    messages = []
    current_id = parent_id
    
    # parent_idから根まで遡る
    while current_id is not None:
        query = select(Message).where(Message.id == current_id)
        result = await db.execute(query)
        message = result.scalar_one_or_none()
        
        if not message:
            break
            
        messages.insert(0, MessageResponse.from_orm(message))
        current_id = message.parent_id
    
    return messages


async def get_active_llm_provider(db: AsyncSession) -> LLMProvider:
    """アクティブなLLMプロバイダーを取得"""
    query = select(LLMProvider).where(LLMProvider.is_active == True)
    result = await db.execute(query)
    provider = result.scalar_one_or_none()
    
    return provider


@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocketエンドポイント"""
    await manager.connect(websocket, client_id)
    
    try:
        while True:
            # クライアントからのメッセージを受信
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # メッセージタイプに応じて処理を分岐
            if message_data.get("type") == "chat_message":
                await handle_chat_message(message_data, client_id, websocket)
            elif message_data.get("type") == "ping":
                await manager.send_json_message({"type": "pong"}, client_id)
            
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        print(f"WebSocket error for client {client_id}: {str(e)}")
        await manager.send_json_message({
            "type": "error",
            "message": "サーバーエラーが発生しました。"
        }, client_id)
        manager.disconnect(client_id)


async def handle_chat_message(message_data: dict, client_id: str, websocket: WebSocket):
    """チャットメッセージを処理"""
    try:
        # データベースセッションを取得
        async for db in get_db():
            # 必要なデータを抽出
            conversation_id = message_data.get("conversation_id")
            parent_id = message_data.get("parent_id")
            message_content = message_data.get("message")
            
            if not all([conversation_id, message_content]):
                await manager.send_json_message({
                    "type": "error",
                    "message": "必要なデータが不足しています。"
                }, client_id)
                return
            
            # 会話の存在確認
            conv_query = select(Conversation).where(Conversation.id == conversation_id)
            conv_result = await db.execute(conv_query)
            conversation = conv_result.scalar_one_or_none()
            
            if not conversation:
                await manager.send_json_message({
                    "type": "error",
                    "message": "会話が見つかりません。"
                }, client_id)
                return
            
            # アクティブなLLMプロバイダーを取得
            provider = await get_active_llm_provider(db)
            
            if not provider:
                await manager.send_json_message({
                    "type": "error",
                    "message": "プロバイダーが選択されていません。設定画面でLLMプロバイダーを選択してください。"
                }, client_id)
                return
            
            # ユーザーメッセージを保存
            user_message = Message(
                conversation_id=conversation_id,
                parent_id=parent_id,
                role="user",
                content=message_content
            )
            db.add(user_message)
            await db.commit()
            await db.refresh(user_message)
            
            # ユーザーメッセージをクライアントに送信
            await manager.send_json_message({
                "type": "user_message",
                "message": {
                    "id": user_message.id,
                    "role": "user",
                    "content": user_message.content,
                    "created_at": user_message.created_at.isoformat()
                }
            }, client_id)
            
            # アシスタントメッセージの開始を通知
            await manager.send_json_message({
                "type": "assistant_message_start"
            }, client_id)
            
            try:
                # 会話履歴を取得
                history = await get_conversation_history(
                    conversation_id,
                    user_message.id,
                    db
                )
                
                # コンテキスト制限に合わせて履歴を切り詰め
                truncated_history = llm_service.truncate_messages_for_context(history)
                
                # ストリーミング応答を生成
                assistant_content = ""
                async for chunk in llm_service.generate_streaming_response(
                    provider,
                    truncated_history
                ):
                    assistant_content += chunk
                    # チャンクをクライアントに送信
                    await manager.send_json_message({
                        "type": "assistant_message_chunk",
                        "chunk": chunk
                    }, client_id)
                
                # アシスタントメッセージを保存
                assistant_message = Message(
                    conversation_id=conversation_id,
                    parent_id=user_message.id,
                    role="assistant",
                    content=assistant_content
                )
                db.add(assistant_message)
                await db.commit()
                await db.refresh(assistant_message)
                
                # アシスタントメッセージの完了を通知
                await manager.send_json_message({
                    "type": "assistant_message_complete",
                    "message": {
                        "id": assistant_message.id,
                        "role": "assistant",
                        "content": assistant_message.content,
                        "created_at": assistant_message.created_at.isoformat()
                    }
                }, client_id)
                
                # 会話の更新日時を更新
                conversation.updated_at = assistant_message.created_at
                await db.commit()
                
            except Exception as e:
                print(f"Error generating LLM response: {str(e)}")
                
                # エラーメッセージをアシスタントメッセージとして保存
                error_message = Message(
                    conversation_id=conversation_id,
                    parent_id=user_message.id,
                    role="assistant",
                    content="申し訳ございません。応答の生成中にエラーが発生しました。しばらく時間をおいて再度お試しください。"
                )
                db.add(error_message)
                await db.commit()
                await db.refresh(error_message)
                
                await manager.send_json_message({
                    "type": "assistant_message_complete",
                    "message": {
                        "id": error_message.id,
                        "role": "assistant",
                        "content": error_message.content,
                        "created_at": error_message.created_at.isoformat()
                    }
                }, client_id)
            
            break  # データベースセッションのループを終了
            
    except Exception as e:
        print(f"Error handling chat message: {str(e)}")
        await manager.send_json_message({
            "type": "error",
            "message": "メッセージの処理中にエラーが発生しました。"
        }, client_id)
