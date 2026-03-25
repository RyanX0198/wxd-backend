/**
 * 润色Prompt模板
 * 参照API_DESIGN.md 风格润色规范
 */

import type { PromptVariables } from '../types/index.ts';
import { replaceVariables, formatStyleGuide } from './loader.ts';

/**
 * 润色基础模板
 */
const POLISH_BASE_TEMPLATE = `你是一位资深的公文润色专家。请对以下内容进行润色，使其符合公文写作规范。

【原文】
{{content}}

【文种类型】{{task.type}}

{{styleGuide}}

润色要求：
1. 修正语法错误和错别字
2. 优化句子结构，使表达更流畅
3. 统一用语风格，符合{{task.type}}特点
4. 调整正式度，使其符合要求
5. 替换口语化表达为规范公文用语
6. 保持原意不变，不增删重要信息

请直接输出润色后的完整内容。`;

/**
 * 深度润色模板
 */
const DEEP_POLISH_TEMPLATE = `你是一位资深的公文润色专家。请对以下内容进行深度润色：

【原文】
{{content}}

【文种类型】{{task.type}}

{{styleGuide}}

润色要求：
1. 全面检查并修正语法、用词、标点错误
2. 优化段落结构，增强逻辑性
3. 统一全文语气和风格
4. 增强语言的感染力和说服力
5. 使用更精准、更专业的公文用语
6. 调整句式，使长短句搭配合理
7. 确保段落之间过渡自然
8. 替换所有禁用词

请直接输出润色后的完整内容。`;

/**
 * 轻度润色模板
 */
const LIGHT_POLISH_TEMPLATE = `你是一位资深的公文润色专家。请对以下内容进行轻度润色：

【原文】
{{content}}

【文种类型】{{task.type}}

润色要求：
1. 仅修正明显的错别字和语法错误
2. 微调不通顺的句子
3. 保持原有风格和表达方式
4. 不做大的结构改动

请直接输出润色后的完整内容。`;

/**
 * 去AI味润色模板
 */
const HUMANIZE_TEMPLATE = `你是一位资深的公文写作专家。请对以下内容进行"去AI味"处理：

【原文】
{{content}}

【文种类型】{{task.type}}

润色要求：
1. 消除机械化的表达痕迹
2. 增加自然的口语化元素（适度）
3. 调整过于工整的句式结构
4. 加入一些个性化的表达
5. 使语言更生动、更有温度
6. 避免过于完美的逻辑递进
7. 适当使用地方特色用语
8. 保持公文规范的前提下，增加人文气息

注意：
- 去AI味不等于降低质量
- 公文规范仍然要遵守
- 只是在规范基础上增加自然感

请直接输出处理后的完整内容。`;

/**
 * 风格调整模板
 */
const STYLE_ADJUST_TEMPLATE = `你是一位资深的公文风格调整专家。请调整以下内容，使其符合指定风格：

【原文】
{{content}}

【文种类型】{{task.type}}

【目标风格】
正式度：{{formality}}/5
语气：{{tone}}

{{#forbiddenWords}}
【禁用词】
以下词汇禁止使用，请替换为更合适的表达：
{{forbiddenWords}}
{{/forbiddenWords}}

{{#preferredWords}}
【推荐词】
优先使用以下词汇：
{{preferredWords}}
{{/preferredWords}}

调整要求：
1. 根据正式度调整用词和句式
2. 统一全文语气，符合目标风格
3. 替换禁用词为推荐词
4. 保持公文基本规范
5. 确保内容连贯性

请直接输出调整后的完整内容。`;

/**
 * 获取润色Prompt
 */
export function getPolishPrompt(
  variables: PromptVariables,
  polishLevel: 'light' | 'normal' | 'deep' | 'humanize' = 'normal'
): string {
  const { task, content, styleGuide } = variables;
  
  if (!content) {
    throw new Error('润色时必须提供content');
  }
  
  // 选择模板
  let template: string;
  switch (polishLevel) {
    case 'light':
      template = LIGHT_POLISH_TEMPLATE;
      break;
    case 'deep':
      template = DEEP_POLISH_TEMPLATE;
      break;
    case 'humanize':
      template = HUMANIZE_TEMPLATE;
      break;
    default:
      template = POLISH_BASE_TEMPLATE;
  }
  
  // 预处理变量
  const processedVars: any = {
    ...variables,
    styleGuide: formatStyleGuide(styleGuide),
    formality: styleGuide?.formality || 3,
    tone: styleGuide?.tone || '标准',
    forbiddenWords: styleGuide?.forbiddenWords?.join('、') || '',
    preferredWords: styleGuide?.preferredWords?.join('、') || ''
  };
  
  return replaceVariables(template, processedVars);
}

/**
 * 获取润色系统角色
 */
export function getPolishSystemRole(polishLevel: string): string {
  const roles: Record<string, string> = {
    'light': '你是一位细致的公文校对专家，擅长发现和修正文字错误，同时保持原文风格。',
    'normal': '你是一位资深的公文润色专家，擅长优化公文表达，使其更规范、更流畅。',
    'deep': '你是一位资深的公文语言大师，擅长深度优化公文，使其达到出版水准。',
    'humanize': '你是一位深谙"去AI味"技巧的专家，擅长让机器生成的文字读起来像人写的一样自然。'
  };
  
  return roles[polishLevel] || roles['normal'];
}

/**
 * 获取风格调整Prompt
 */
export function getStyleAdjustPrompt(
  content: string,
  documentType: string,
  styleGuide: {
    formality: number;
    tone: string;
    forbiddenWords?: string[];
    preferredWords?: string[];
  }
): string {
  const variables: PromptVariables = {
    task: {
      id: '',
      type: documentType as any,
      topic: '',
      from: '',
      to: '',
      createdAt: new Date()
    },
    content,
    styleGuide: {
      ...styleGuide,
      sentenceStructure: '',
      forbiddenWords: styleGuide.forbiddenWords || [],
      preferredWords: styleGuide.preferredWords || []
    }
  };
  
  const replaceVars: any = {
    ...variables,
    formality: styleGuide.formality,
    tone: styleGuide.tone,
    forbiddenWords: styleGuide.forbiddenWords?.join('、') || '',
    preferredWords: styleGuide.preferredWords?.join('、') || ''
  };
  
  return replaceVariables(STYLE_ADJUST_TEMPLATE, replaceVars);
}

/**
 * 获取禁用词替换Prompt
 */
export function getForbiddenWordsPrompt(
  content: string,
  forbiddenWords: string[],
  replacements?: Record<string, string>
): string {
  return `你是一位资深的公文用语专家。请将以下内容中的禁用词替换为更合适的表达：

【原文】
${content}

【禁用词列表】
${forbiddenWords.map(w => `- ${w}`).join('\n')}

${replacements ? `【推荐替换】
${Object.entries(replacements).map(([k, v]) => `- ${k} → ${v}`).join('\n')}` : ''}

替换要求：
1. 将禁用词替换为意思相近但更合适的表达
2. 保持句子通顺、意思不变
3. 优先使用公文规范用语
4. 输出完整的替换后内容

请直接输出替换后的完整内容。`;
}
