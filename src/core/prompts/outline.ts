/**
 * 大纲生成Prompt模板
 * 参照API_DESIGN.md 公文写作规范
 */

import type { PromptVariables } from '../types/index.ts';
import { replaceVariables, formatUserMemory, formatRetrievedContext, formatStyleGuide } from './loader.ts';

/**
 * 大纲生成基础模板
 */
const OUTLINE_BASE_TEMPLATE = `你是一位资深的政府公文写作专家，专门负责为各类教育政务公文生成结构清晰、逻辑严密的大纲。

【任务信息】
文种类型：{{task.type}}
主题：{{task.topic}}
发文单位：{{task.from}}
主送对象：{{task.to}}
{{#task.wordCount}}字数要求：{{task.wordCount}}字{{/task.wordCount}}
{{#task.formality}}正式度：{{task.formality}}/5{{/task.formality}}

【要求】
{{task.requirements}}

{{memory}}

{{context}}

{{styleGuide}}

请根据以上信息，生成一份详细的大纲。大纲需要：

1. **结构完整**：符合该文种的标准结构
2. **逻辑清晰**：层次分明，段落之间有逻辑关联
3. **详略得当**：重点突出，次要内容简洁
4. **字数分配**：合理分配各部分字数

请以JSON格式输出大纲，格式如下：

{
  "title": "文档标题",
  "sections": [
    {
      "id": "1",
      "title": "第一部分标题",
      "estimatedWords": 300,
      "subsections": [
        {
          "id": "1.1",
          "title": "小节标题",
          "estimatedWords": 150
        }
      ]
    }
  ],
  "totalWords": 2000
}

注意：
- 只输出JSON，不要有其他说明文字
- 确保JSON格式正确，可以被解析
- id使用数字编号，如 "1", "1.1", "1.1.1"`;

/**
 * 讲话稿大纲模板
 */
const SPEECH_OUTLINE_TEMPLATE = `你是一位资深的政务演讲撰稿专家。请为以下讲话稿生成大纲：

【讲话主题】{{task.topic}}
【讲话人身份】{{task.from}}
【听众对象】{{task.to}}
{{#task.wordCount}}【字数要求】{{task.wordCount}}字{{/task.wordCount}}

{{memory}}

{{context}}

讲话稿的标准结构包括：
1. **开场白** - 问候、自我介绍、点明主题（约占总字数5-8%）
2. **工作回顾/背景阐述** - 总结成绩、数据支撑（约占总字数20-25%）
3. **形势分析** - 当前面临的机遇与挑战（约占总字数15-20%）
4. **工作部署** - 重点任务、具体措施（约占总字数30-35%）
5. **动员号召** - 鼓舞士气、提出要求（约占总字数10-15%）
6. **结束语** - 感谢、祝愿（约占总字数3-5%）

请以JSON格式输出大纲，包含标题、各部分标题和预估字数。

注意：
- 讲话稿要有感染力和号召力
- 各部分之间要有自然的过渡
- 只输出JSON格式，不要有其他说明`;

/**
 * 通知大纲模板
 */
const NOTICE_OUTLINE_TEMPLATE = `你是一位资深的政府机关公文写作专家。请为以下活动通知生成大纲：

【活动名称】{{task.topic}}
【发文单位】{{task.from}}
【通知对象】{{task.to}}

{{memory}}

通知的标准结构包括：
1. **通知缘由** - 发文目的和依据
2. **活动安排** - 时间、地点、参加人员
3. **具体要求** - 需要落实的事项
4. **其他事项** - 联系方式、附件等

请以JSON格式输出大纲。

注意：
- 通知要求简洁明了，一事一通知
- 时间、地点必须明确具体
- 只输出JSON格式`;

/**
 * 工作总结大纲模板
 */
const SUMMARY_OUTLINE_TEMPLATE = `你是一位资深的政府机关公文写作专家。请为以下工作总结生成大纲：

【总结主题】{{task.topic}}
【单位名称】{{task.from}}
【上报对象】{{task.to}}
{{#task.wordCount}}【字数要求】{{task.wordCount}}字{{/task.wordCount}}

{{memory}}

{{context}}

工作总结的标准结构包括：
1. **概述** - 工作背景、总体情况
2. **主要成绩** - 用数据说话，展示具体成果
3. **主要做法** - 经验提炼，有理论高度
4. **存在问题** - 实事求是，不回避矛盾
5. **下步打算** - 具体可行，措施得力

请以JSON格式输出大纲。

注意：
- 成绩部分要有具体数据和实例
- 问题部分要客观真实
- 只输出JSON格式`;

/**
 * 默认大纲模板（通用）
 */
const DEFAULT_OUTLINE_TEMPLATE = `你是一位资深的政府机关公文写作专家。请为以下公文生成大纲：

【文种】{{task.type}}
【主题】{{task.topic}}
【发文单位】{{task.from}}
【主送对象】{{task.to}}
{{#task.wordCount}}【字数要求】{{task.wordCount}}字{{/task.wordCount}}

{{memory}}

{{context}}

{{styleGuide}}

请根据{{task.type}}的规范格式，生成一份详细的大纲。大纲应该：
1. 符合该文种的规范结构
2. 逻辑清晰，层次分明
3. 各部分字数分配合理

请以JSON格式输出大纲，格式如下：
{
  "title": "文档标题",
  "sections": [
    {
      "id": "1",
      "title": "第一部分标题",
      "estimatedWords": 300
    }
  ],
  "totalWords": 2000
}

只输出JSON，不要有其他说明。`;

/**
 * 获取大纲生成Prompt
 */
export function getOutlinePrompt(variables: PromptVariables): string {
  const { task, memory, context, styleGuide } = variables;
  
  // 选择模板
  let template: string;
  switch (task.type) {
    case '讲话稿':
      template = SPEECH_OUTLINE_TEMPLATE;
      break;
    case '活动通知':
      template = NOTICE_OUTLINE_TEMPLATE;
      break;
    case '工作总结':
      template = SUMMARY_OUTLINE_TEMPLATE;
      break;
    default:
      template = DEFAULT_OUTLINE_TEMPLATE;
  }
  
  // 预处理变量
  const processedVars: any = {
    ...variables,
    memory: formatUserMemory(memory),
    context: formatRetrievedContext(context || []),
    styleGuide: formatStyleGuide(styleGuide),
    'task.requirements': task.requirements?.join('\n') || '无特殊要求'
  };
  
  return replaceVariables(template, processedVars);
}

/**
 * 获取大纲系统角色
 */
export function getOutlineSystemRole(): string {
  return `你是一位资深的政府公文写作专家，拥有20年以上的公文写作经验。
你擅长各类教育政务公文的结构设计和内容规划。
你的任务是为公文生成清晰、规范、逻辑严密的大纲。
你必须以JSON格式输出大纲，确保格式正确、可解析。`;
}

/**
 * 获取大纲确认Prompt
 * 用于用户修改大纲后的重新生成
 */
export function getOutlineConfirmationPrompt(
  originalOutline: string,
  modifications: string
): string {
  return `请根据用户的修改意见，对原大纲进行调整：

【原大纲】
${originalOutline}

【修改意见】
${modifications}

请输出调整后的新大纲，保持JSON格式不变。`;
}
