/**
 * 内容撰写Prompt模板
 * 参照API_DESIGN.md 公文写作规范
 */

import type { PromptVariables, OutlineSection } from '../types/index.ts';
import { replaceVariables, formatUserMemory, formatRetrievedContext, formatStyleGuide } from './loader.ts';

/**
 * 内容撰写基础模板
 */
const WRITING_BASE_TEMPLATE = `你是一位资深的政府公文写作专家。请根据以下信息撰写公文内容：

【文种类型】{{task.type}}
【主题】{{task.topic}}
【发文单位】{{task.from}}
【主送对象】{{task.to}}

{{memory}}

{{context}}

{{styleGuide}}

【当前撰写部分】
部分标题：{{section.title}}
{{#section.estimatedWords}}预估字数：{{section.estimatedWords}}字{{/section.estimatedWords}}

【大纲上下文】
{{outlineContext}}

【已生成内容】
{{previousContent}}

写作要求：
1. 紧扣部分标题，内容充实
2. 语言庄重得体，符合{{task.type}}特点
3. 使用规范公文用语，避免口语化
4. 与已生成内容保持连贯
5. 注意段落之间的衔接和过渡

请直接输出该部分的正文内容，不需要标注格式说明。`;

/**
 * 讲话稿撰写模板
 */
const SPEECH_WRITING_TEMPLATE = `你是一位资深的政务演讲撰稿专家。请撰写讲话稿的以下部分：

【讲话主题】{{task.topic}}
【讲话人身份】{{task.from}}
【听众对象】{{task.to}}

{{memory}}

{{context}}

【当前撰写部分】{{section.title}}
{{#section.estimatedWords}}预估字数：{{section.estimatedWords}}字{{/section.estimatedWords}}

【大纲全文】
{{outlineContext}}

【已生成的前文】
{{previousContent}}

写作要求：
1. 语言要有感染力和号召力，适合口头表达
2. 使用教育政务专业用语，体现领导水平
3. 适当使用排比、对偶增强气势
4. 要有具体数据和实例支撑
5. 段落不宜过长，便于演讲时换气
6. 与上下文自然衔接，过渡流畅

请直接输出该部分的正文内容。`;

/**
 * 通知撰写模板
 */
const NOTICE_WRITING_TEMPLATE = `你是一位资深的政府机关公文写作专家。请撰写通知的以下部分：

【活动名称】{{task.topic}}
【发文单位】{{task.from}}
【通知对象】{{task.to}}

【当前撰写部分】{{section.title}}

【大纲全文】
{{outlineContext}}

【已生成的前文】
{{previousContent}}

写作要求：
1. 符合《党政机关公文处理工作条例》格式规范
2. 语言简洁明了，一事一通知
3. 时间、地点、要求必须明确具体
4. 使用规范的公文用语
5. 与上下文自然衔接

请直接输出该部分的正文内容。`;

/**
 * 工作总结撰写模板
 */
const SUMMARY_WRITING_TEMPLATE = `你是一位资深的政府机关公文写作专家。请撰写工作总结的以下部分：

【总结主题】{{task.topic}}
【单位名称】{{task.from}}
【上报对象】{{task.to}}

{{context}}

【当前撰写部分】{{section.title}}
{{#section.estimatedWords}}预估字数：{{section.estimatedWords}}字{{/section.estimatedWords}}

【大纲全文】
{{outlineContext}}

【已生成的前文】
{{previousContent}}

写作要求：
1. 成绩部分要用数据说话，展示具体成果
2. 问题部分要实事求是，不回避矛盾
3. 经验要有理论高度，提炼到位
4. 下步打算要具体可行，措施得力
5. 语言庄重、准确、简练
6. 与上下文自然衔接

请直接输出该部分的正文内容。`;

/**
 * 请示撰写模板
 */
const REQUEST_WRITING_TEMPLATE = `你是一位资深的政府机关公文写作专家。请撰写请示的以下部分：

【请示事项】{{task.topic}}
【请示单位】{{task.from}}
【主送机关】{{task.to}}

【当前撰写部分】{{section.title}}

【大纲全文】
{{outlineContext}}

【已生成的前文】
{{previousContent}}

写作要求：
1. 一文一事，不得多头请示
2. 请示缘由充分，理由具体
3. 请示事项明确，意见具体可行
4. 结语使用规范用语
5. 语言谦逊得体
6. 与上下文自然衔接

请直接输出该部分的正文内容。`;

/**
 * 报告撰写模板
 */
const REPORT_WRITING_TEMPLATE = `你是一位资深的政府机关公文写作专家。请撰写报告的以下部分：

【报告主题】{{task.topic}}
【报告单位】{{task.from}}
【主送机关】{{task.to}}

【当前撰写部分】{{section.title}}
{{#section.estimatedWords}}预估字数：{{section.estimatedWords}}字{{/section.estimatedWords}}

【大纲全文】
{{outlineContext}}

【已生成的前文】
{{previousContent}}

写作要求：
1. 内容实事求是，情况准确
2. 条理清晰，层次分明
3. 不得夹带请示事项
4. 结语使用规范用语
5. 语言庄重、准确、简练
6. 与上下文自然衔接

请直接输出该部分的正文内容。`;

/**
 * 获取内容撰写Prompt
 */
export function getWritingPrompt(variables: PromptVariables): string {
  const { task, section, outline, memory, context, styleGuide } = variables;
  
  if (!section) {
    throw new Error('撰写内容时必须提供section');
  }
  
  // 选择模板
  let template: string;
  switch (task.type) {
    case '讲话稿':
      template = SPEECH_WRITING_TEMPLATE;
      break;
    case '活动通知':
      template = NOTICE_WRITING_TEMPLATE;
      break;
    case '工作总结':
      template = SUMMARY_WRITING_TEMPLATE;
      break;
    case '请示':
      template = REQUEST_WRITING_TEMPLATE;
      break;
    case '报告':
      template = REPORT_WRITING_TEMPLATE;
      break;
    default:
      template = WRITING_BASE_TEMPLATE;
  }
  
  // 构建大纲上下文
  const outlineContext = outline ? formatOutlineContext(outline) : '';
  
  // 预处理变量
  const processedVars: any = {
    ...variables,
    memory: formatUserMemory(memory),
    context: formatRetrievedContext(context || []),
    styleGuide: formatStyleGuide(styleGuide),
    outlineContext,
    previousContent: variables.content || '（这是第一部分，无前文）'
  };
  
  return replaceVariables(template, processedVars);
}

/**
 * 获取撰写系统角色
 */
export function getWritingSystemRole(documentType: string): string {
  const roles: Record<string, string> = {
    '讲话稿': '你是一位资深的政务演讲撰稿专家，拥有20年以上为领导撰写讲话稿的经验。你擅长撰写有感染力、有深度的讲话稿，语言庄重得体，适合口头表达。',
    '活动通知': '你是一位资深的政府机关公文写作专家，精通《党政机关公文处理工作条例》。你擅长撰写规范、简洁、明确的活动通知。',
    '工作总结': '你是一位资深的政府机关公文写作专家，擅长撰写高质量的工作总结。你善于用数据说话，经验提炼到位，问题分析客观。',
    '请示': '你是一位资深的政府机关公文写作专家，精通请示的写作规范。你擅长把请示缘由写得充分，请示事项写得明确。',
    '报告': '你是一位资深的政府机关公文写作专家，精通报告的写作规范。你擅长把报告内容写得实事求是、条理清晰。',
    'default': '你是一位资深的政府公文写作专家，拥有20年以上的公文写作经验。你精通各类教育政务公文的写作规范，擅长撰写高质量、规范化的公文。'
  };
  
  return roles[documentType] || roles['default'];
}

/**
 * 格式化大纲上下文
 */
function formatOutlineContext(outline: { title: string; sections: OutlineSection[] }): string {
  const lines: string[] = [`文档标题：${outline.title}`, '大纲结构：'];
  
  outline.sections.forEach((section, index) => {
    lines.push(`${index + 1}. ${section.title}`);
    if (section.subsections) {
      section.subsections.forEach((sub) => {
        lines.push(`   ${sub.id}. ${sub.title}`);
      });
    }
  });
  
  return lines.join('\n');
}
