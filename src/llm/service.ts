/**
 * LLM服务 - Kimi API集成
 * 参照API_DESIGN.md 外部服务集成规范
 * 
 * 功能：
 * - 流式输出（SSE）
 * - 重试机制
 * - 错误处理
 * - 上下文长度管理
 */

import type { LLMConfig, StreamEvent } from '../core/types/index.ts';

// Kimi API配置
const KIMI_API_KEY = process.env.KIMI_API_KEY || '';
const KIMI_BASE_URL = process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1';
const KIMI_MODEL = process.env.KIMI_MODEL || 'moonshot-v1-8k';

// 重试配置
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1秒
  maxDelay: 10000, // 10秒
};

// 上下文长度限制
const CONTEXT_LIMITS: Record<string, number> = {
  'moonshot-v1-8k': 8000,
  'moonshot-v1-32k': 32000,
  'moonshot-v1-128k': 128000,
};

/**
 * 计算延迟时间（指数退避）
 */
function calculateDelay(attempt: number): number {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
    RETRY_CONFIG.maxDelay
  );
  // 添加随机因子，避免雪崩
  return delay + Math.random() * 1000;
}

/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 估算token数量（简化版）
 * 中文：1字符 ≈ 1 token
 * 英文：1单词 ≈ 1.3 tokens
 */
export function estimateTokenCount(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const otherChars = text.length - chineseChars - englishWords;
  return Math.ceil(chineseChars + englishWords * 1.3 + otherChars * 0.5);
}

/**
 * 截断上下文以适应模型限制
 */
export function truncateContext(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  reserveTokens: number = 1000
): Array<{ role: string; content: string }> {
  const availableTokens = maxTokens - reserveTokens;
  let totalTokens = 0;
  
  // 从后往前遍历，保留最新的消息
  const result: Array<{ role: string; content: string }> = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const tokens = estimateTokenCount(msg.content);
    
    if (totalTokens + tokens > availableTokens) {
      // 如果第一条消息就超限，截断它
      if (i === messages.length - 1) {
        const truncatedContent = msg.content.slice(0, Math.floor(availableTokens * 2));
        result.unshift({ ...msg, content: truncatedContent + '...' });
      }
      break;
    }
    
    totalTokens += tokens;
    result.unshift(msg);
  }
  
  return result;
}

/**
 * Kimi API错误类
 */
export class KimiAPIError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'KimiAPIError';
  }
}

/**
 * 非流式调用Kimi API
 */
export async function callKimiAPI(
  messages: Array<{ role: string; content: string }>,
  options: Partial<LLMConfig> = {}
): Promise<string> {
  const config: LLMConfig = {
    apiKey: options.apiKey || KIMI_API_KEY,
    baseUrl: options.baseUrl || KIMI_BASE_URL,
    model: options.model || KIMI_MODEL,
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens || 4000,
    streaming: false,
  };

  if (!config.apiKey) {
    throw new KimiAPIError('未配置Kimi API Key', 'MISSING_API_KEY', undefined, false);
  }

  // 上下文长度管理
  const maxContextTokens = CONTEXT_LIMITS[config.model] || 8000;
  const processedMessages = truncateContext(messages, maxContextTokens, config.maxTokens);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      console.log(`[KimiAPI] 调用尝试 ${attempt + 1}/${RETRY_CONFIG.maxRetries}`);
      
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: processedMessages,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        
        // 判断是否可以重试
        const retryable = response.status >= 500 || response.status === 429;
        
        throw new KimiAPIError(
          errorMessage,
          errorData.error?.code,
          response.status,
          retryable
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new KimiAPIError('API返回内容为空', 'EMPTY_RESPONSE', undefined, true);
      }

      console.log(`[KimiAPI] 调用成功，使用token: ${data.usage?.total_tokens || 'unknown'}`);
      return content;

    } catch (error) {
      lastError = error as Error;
      
      // 如果是非重试错误，直接抛出
      if (error instanceof KimiAPIError && !error.retryable) {
        throw error;
      }
      
      // 最后一次尝试，不再重试
      if (attempt === RETRY_CONFIG.maxRetries - 1) {
        break;
      }
      
      // 等待后重试
      const delay = calculateDelay(attempt);
      console.log(`[KimiAPI] 调用失败，${delay}ms后重试: ${error instanceof Error ? error.message : '未知错误'}`);
      await sleep(delay);
    }
  }

  throw lastError || new KimiAPIError('所有重试均失败', 'MAX_RETRIES_EXCEEDED', undefined, false);
}

/**
 * 流式调用Kimi API
 */
export async function* streamKimiAPI(
  messages: Array<{ role: string; content: string }>,
  options: Partial<LLMConfig> = {}
): AsyncGenerator<StreamEvent, void, unknown> {
  const config: LLMConfig = {
    apiKey: options.apiKey || KIMI_API_KEY,
    baseUrl: options.baseUrl || KIMI_BASE_URL,
    model: options.model || KIMI_MODEL,
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens || 4000,
    streaming: true,
  };

  if (!config.apiKey) {
    yield {
      type: 'error',
      message: '未配置Kimi API Key',
      timestamp: new Date(),
    };
    return;
  }

  // 上下文长度管理
  const maxContextTokens = CONTEXT_LIMITS[config.model] || 8000;
  const processedMessages = truncateContext(messages, maxContextTokens, config.maxTokens);

  let attempt = 0;

  while (attempt < RETRY_CONFIG.maxRetries) {
    try {
      console.log(`[KimiAPI] 流式调用尝试 ${attempt + 1}/${RETRY_CONFIG.maxRetries}`);
      
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: processedMessages,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new KimiAPIError(
          errorData.error?.message || `HTTP ${response.status}`,
          errorData.error?.code,
          response.status,
          response.status >= 500 || response.status === 429
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new KimiAPIError('无法读取响应流', 'STREAM_ERROR', undefined, true);
      }

      // 发送开始事件
      yield {
        type: 'start',
        timestamp: new Date(),
      };

      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              yield {
                type: 'completed',
                data: { content: fullContent },
                timestamp: new Date(),
              };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              
              if (delta) {
                fullContent += delta;
                yield {
                  type: 'chunk',
                  data: { content: delta, fullContent },
                  timestamp: new Date(),
                };
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      return;

    } catch (error) {
      attempt++;
      
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error(`[KimiAPI] 流式调用失败: ${errorMessage}`);
      
      // 非重试错误或最后一次尝试
      if (
        (error instanceof KimiAPIError && !error.retryable) ||
        attempt >= RETRY_CONFIG.maxRetries
      ) {
        yield {
          type: 'error',
          message: errorMessage,
          timestamp: new Date(),
        };
        return;
      }
      
      // 等待后重试
      const delay = calculateDelay(attempt - 1);
      console.log(`[KimiAPI] ${delay}ms后重试...`);
      await sleep(delay);
    }
  }
}

/**
 * 检查Kimi API配置
 */
export function checkKimiConfig(): { valid: boolean; message: string } {
  if (!KIMI_API_KEY) {
    return {
      valid: false,
      message: '未配置KIMI_API_KEY环境变量',
    };
  }
  
  if (!KIMI_API_KEY.startsWith('sk-')) {
    return {
      valid: false,
      message: 'KIMI_API_KEY格式不正确，应以sk-开头',
    };
  }
  
  return {
    valid: true,
    message: 'Kimi API配置正常',
  };
}

/**
 * 获取可用的模型列表
 */
export function getAvailableModels(): string[] {
  return Object.keys(CONTEXT_LIMITS);
}

/**
 * 获取模型的上下文限制
 */
export function getModelContextLimit(model: string): number {
  return CONTEXT_LIMITS[model] || 8000;
}
