/**
 * Prompt模板加载器
 * 支持从PROMPTS.md读取和模板变量替换
 * 参照API_DESIGN.md 模块化规范
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { PromptVariables, WritingTask, DocumentOutline, OutlineSection, UserMemory, RetrievedContext, StyleGuide } from '../types/index.ts';

// 当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prompt模板缓存
const promptCache: Map<string, string> = new Map();

// PROMPTS.md 文件路径
const PROMPTS_MD_PATH = path.resolve(__dirname, '../../../../docs/PROMPTS.md');

/**
 * 模板变量占位符正则表达式
 * 支持 {{variable}} 格式
 */
const VARIABLE_REGEX = /\{\{(\w+)(?:\.(\w+))?\}\}/g;

/**
 * 从文件加载Prompt
 */
export function loadPromptFromFile(filePath: string): string {
  if (promptCache.has(filePath)) {
    return promptCache.get(filePath)!;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    promptCache.set(filePath, content);
    return content;
  } catch (error) {
    console.error(`[PromptLoader] 加载Prompt文件失败: ${filePath}`, error);
    throw new Error(`无法加载Prompt文件: ${filePath}`);
  }
}

/**
 * 从PROMPTS.md解析特定section
 */
export function loadPromptFromMarkdown(sectionName: string): string | null {
  const cacheKey = `md:${sectionName}`;
  if (promptCache.has(cacheKey)) {
    return promptCache.get(cacheKey)!;
  }

  try {
    if (!fs.existsSync(PROMPTS_MD_PATH)) {
      console.warn(`[PromptLoader] PROMPTS.md 不存在: ${PROMPTS_MD_PATH}`);
      return null;
    }

    const content = fs.readFileSync(PROMPTS_MD_PATH, 'utf-8');
    const sectionRegex = new RegExp(`## ${sectionName}([\\s\\S]*?)(?=## |$)`);
    const match = content.match(sectionRegex);

    if (!match) {
      console.warn(`[PromptLoader] 在PROMPTS.md中未找到section: ${sectionName}`);
      return null;
    }

    const prompt = match[1].trim();
    promptCache.set(cacheKey, prompt);
    return prompt;
  } catch (error) {
    console.error(`[PromptLoader] 解析PROMPTS.md失败:`, error);
    return null;
  }
}

/**
 * 模板变量替换
 * 支持嵌套属性访问，如 {{task.topic}}
 */
export function replaceVariables(template: string, variables: PromptVariables): string {
  return template.replace(VARIABLE_REGEX, (match, key, subKey) => {
    const value = getNestedValue(variables, key, subKey);
    return value !== undefined ? String(value) : match;
  });
}

/**
 * 获取嵌套对象值
 */
function getNestedValue(obj: any, key: string, subKey?: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  
  const value = obj[key];
  if (subKey && value && typeof value === 'object') {
    return value[subKey];
  }
  return value;
}

/**
 * 构建基础变量对象
 */
export function buildPromptVariables(
  task: WritingTask,
  options: {
    outline?: DocumentOutline;
    section?: OutlineSection;
    memory?: UserMemory;
    context?: RetrievedContext[];
    styleGuide?: StyleGuide;
    content?: string;
  } = {}
): PromptVariables {
  return {
    task,
    ...options
  };
}

/**
 * 格式化检索上下文
 */
export function formatRetrievedContext(context: RetrievedContext[]): string {
  if (!context || context.length === 0) {
    return '';
  }

  return context.map((ctx, index) => {
    return `【参考资料 ${index + 1}】
类型：${ctx.type}
标题：${ctx.title}
相关度：${(ctx.relevance * 100).toFixed(1)}%
内容：
${ctx.content}
---`;
  }).join('\n\n');
}

/**
 * 格式化用户偏好
 */
export function formatUserMemory(memory?: UserMemory): string {
  if (!memory) {
    return '';
  }

  const parts: string[] = [];
  
  if (memory.preferences.favoriteStyles.length > 0) {
    parts.push(`偏好风格：${memory.preferences.favoriteStyles.join('、')}`);
  }
  
  if (memory.preferences.commonPhrases.length > 0) {
    parts.push(`常用表达：${memory.preferences.commonPhrases.join('、')}`);
  }
  
  if (memory.history.recentTopics.length > 0) {
    parts.push(`近期主题：${memory.history.recentTopics.slice(0, 5).join('、')}`);
  }

  return parts.length > 0 ? `【用户偏好】\n${parts.join('\n')}\n` : '';
}

/**
 * 格式化风格指南
 */
export function formatStyleGuide(styleGuide?: StyleGuide): string {
  if (!styleGuide) {
    return '';
  }

  const parts: string[] = [];
  
  parts.push(`正式度：${styleGuide.formality}/5`);
  parts.push(`语气：${styleGuide.tone}`);
  
  if (styleGuide.forbiddenWords.length > 0) {
    parts.push(`禁用词：${styleGuide.forbiddenWords.join('、')}`);
  }
  
  if (styleGuide.preferredWords.length > 0) {
    parts.push(`推荐词：${styleGuide.preferredWords.join('、')}`);
  }

  return `【风格要求】\n${parts.join('\n')}\n`;
}

/**
 * 清除缓存
 */
export function clearPromptCache(): void {
  promptCache.clear();
  console.log('[PromptLoader] Prompt缓存已清除');
}

/**
 * 重新加载Prompt
 */
export function reloadPrompt(source: string, isMarkdown: boolean = false): string | null {
  const cacheKey = isMarkdown ? `md:${source}` : source;
  promptCache.delete(cacheKey);
  
  if (isMarkdown) {
    return loadPromptFromMarkdown(source);
  } else {
    return loadPromptFromFile(source);
  }
}
