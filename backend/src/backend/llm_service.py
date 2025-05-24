import openai
import anthropic
import google.generativeai as genai
import httpx
from typing import List, Dict, Any, Optional
import os
from dotenv import load_dotenv

from .models import LLMProvider
from .schemas import MessageResponse

load_dotenv()


class LLMService:
    """LLMプロバイダーとの統合サービス"""
    
    def __init__(self):
        self.clients = {}  # プロバイダーIDごとにクライアントをキャッシュ
    
    def _get_provider_type(self, provider: LLMProvider) -> str:
        """プロバイダーの種類を判定"""
        name_lower = provider.name.lower()
        
        if "openai" in name_lower or "gpt" in name_lower:
            return "openai"
        elif "azure" in name_lower:
            return "openai"  # Azure OpenAI は OpenAI API と同じ
        elif "anthropic" in name_lower or "claude" in name_lower:
            return "anthropic"
        elif "gemini" in name_lower or "google" in name_lower:
            return "gemini"
        elif "ollama" in name_lower:
            return "ollama"
        else:
            # モデル名からも判定を試行
            model_lower = provider.model_name.lower()
            if "gpt" in model_lower:
                return "openai"
            elif "claude" in model_lower:
                return "anthropic"
            elif "gemini" in model_lower:
                return "gemini"
            elif "llama" in model_lower or "qwen" in model_lower:
                return "ollama"
            else:
                raise ValueError(f"Cannot determine provider type for: {provider.name} with model: {provider.model_name}")
    
    async def generate_response(
        self,
        provider: LLMProvider,
        messages: List[MessageResponse],
        max_tokens: int = 2000
    ) -> str:
        """LLMからの応答を生成"""
        
        provider_type = self._get_provider_type(provider)
        
        # メッセージを適切な形式に変換
        formatted_messages = self._format_messages_for_provider(provider_type, messages)
        
        try:
            if provider_type == "openai":
                return await self._generate_openai_response(
                    provider, formatted_messages, max_tokens
                )
            elif provider_type == "anthropic":
                return await self._generate_anthropic_response(
                    provider, formatted_messages, max_tokens
                )
            elif provider_type == "gemini":
                return await self._generate_gemini_response(
                    provider, formatted_messages, max_tokens
                )
            elif provider_type == "ollama":
                return await self._generate_ollama_response(
                    provider, formatted_messages, max_tokens
                )
            else:
                raise ValueError(f"Unsupported provider type: {provider_type}")
                
        except Exception as e:
            # エラーハンドリング - 実際のアプリケーションではより詳細なログを記録
            print(f"Error generating response from {provider.name} ({provider_type}): {str(e)}")
            return f"申し訳ございません。{provider.name}からの応答生成中にエラーが発生しました。"
    
    def _format_messages_for_provider(
        self, 
        provider_name: str, 
        messages: List[MessageResponse]
    ) -> List[Dict[str, str]]:
        """プロバイダー固有の形式にメッセージを変換"""
        formatted = []
        
        for msg in messages:
            if provider_name == "anthropic" and msg.role == "system":
                # Anthropicはsystemメッセージを別途処理
                continue
            
            formatted.append({
                "role": msg.role,
                "content": msg.content
            })
        
        return formatted
    
    async def _generate_openai_response(
        self,
        provider: LLMProvider,
        messages: List[Dict[str, str]],
        max_tokens: int
    ) -> str:
        """OpenAI/Azure OpenAI APIからの応答生成"""
        # プロバイダーごとにクライアントをキャッシュ
        client_key = f"openai_{provider.id}"
        if client_key not in self.clients:
            # APIキーが無効な場合のチェック
            if not provider.api_key or provider.api_key == "your-api-key-here":
                raise ValueError(f"Invalid API key for {provider.name}. Please set a valid API key in settings.")
            
            base_url = provider.api_url if provider.api_url else None
            self.clients[client_key] = openai.AsyncOpenAI(
                api_key=provider.api_key,
                base_url=base_url
            )
        
        client = self.clients[client_key]
        response = await client.chat.completions.create(
            model=provider.model_name,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.7
        )
        
        return response.choices[0].message.content
    
    async def _generate_anthropic_response(
        self,
        provider: LLMProvider,
        messages: List[Dict[str, str]],
        max_tokens: int
    ) -> str:
        """Anthropic APIからの応答生成"""
        # プロバイダーごとにクライアントをキャッシュ
        client_key = f"anthropic_{provider.id}"
        if client_key not in self.clients:
            if not provider.api_key or provider.api_key == "your-api-key-here":
                raise ValueError(f"Invalid API key for {provider.name}. Please set a valid API key in settings.")
            
            self.clients[client_key] = anthropic.AsyncAnthropic(api_key=provider.api_key)
        
        client = self.clients[client_key]
        
        # systemメッセージを分離
        system_message = ""
        user_messages = []
        
        for msg in messages:
            if msg["role"] == "system":
                system_message = msg["content"]
            else:
                user_messages.append(msg)
        
        response = await client.messages.create(
            model=provider.model_name,
            max_tokens=max_tokens,
            system=system_message if system_message else "You are a helpful assistant.",
            messages=user_messages
        )
        
        return response.content[0].text
    
    async def _generate_gemini_response(
        self,
        provider: LLMProvider,
        messages: List[Dict[str, str]],
        max_tokens: int
    ) -> str:
        """Google Gemini APIからの応答生成"""
        if not provider.api_key or provider.api_key == "your-api-key-here":
            raise ValueError(f"Invalid API key for {provider.name}. Please set a valid API key in settings.")
        
        genai.configure(api_key=provider.api_key)
        model = genai.GenerativeModel(provider.model_name)
        
        # Gemini用にメッセージを変換
        conversation_text = ""
        for msg in messages:
            role_prefix = "Human: " if msg["role"] == "user" else "Assistant: "
            conversation_text += f"{role_prefix}{msg['content']}\n\n"
        
        conversation_text += "Assistant: "
        
        response = await model.generate_content_async(
            conversation_text,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=max_tokens,
                temperature=0.7
            )
        )
        
        return response.text
    
    async def _generate_ollama_response(
        self,
        provider: LLMProvider,
        messages: List[Dict[str, str]],
        max_tokens: int
    ) -> str:
        """Ollama APIからの応答生成"""
        # api_urlが設定されているかチェック
        if not provider.api_url:
            raise ValueError(f"Ollama provider '{provider.name}' requires a base URL. Please set the base URL in settings (e.g., http://localhost:11434)")
        
        # メッセージを単一のプロンプトに変換
        prompt = ""
        for msg in messages:
            if msg["role"] == "user":
                prompt += f"User: {msg['content']}\n"
            elif msg["role"] == "assistant":
                prompt += f"Assistant: {msg['content']}\n"
            elif msg["role"] == "system":
                prompt += f"System: {msg['content']}\n"
        
        prompt += "Assistant: "
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{provider.api_url}/api/generate",
                    json={
                        "model": provider.model_name,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "num_predict": max_tokens,
                            "temperature": 0.7
                        }
                    },
                    timeout=60.0
                )
                
                response.raise_for_status()
                result = response.json()
                
                return result["response"]
        except httpx.ConnectError:
            raise ValueError(f"Cannot connect to Ollama server at {provider.api_url}. Please ensure Ollama is running and accessible.")
        except httpx.TimeoutException:
            raise ValueError(f"Timeout connecting to Ollama server at {provider.api_url}. The request took too long.")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ValueError(f"Model '{provider.model_name}' not found on Ollama server. Please check if the model is installed.")
            else:
                raise ValueError(f"Ollama server error (HTTP {e.response.status_code}): {e.response.text}")
    
    def truncate_messages_for_context(
        self,
        messages: List[MessageResponse],
        max_tokens: int = 4000
    ) -> List[MessageResponse]:
        """コンテキスト制限に合わせてメッセージを切り詰め"""
        # 簡単な実装：文字数ベースで切り詰め（実際にはトークン数で計算すべき）
        total_chars = 0
        truncated_messages = []
        
        # 最新のメッセージから逆順で追加
        for message in reversed(messages):
            message_chars = len(message.content)
            if total_chars + message_chars > max_tokens * 4:  # 大まかな文字数換算
                break
            
            truncated_messages.insert(0, message)
            total_chars += message_chars
        
        return truncated_messages


# グローバルインスタンス
llm_service = LLMService()
