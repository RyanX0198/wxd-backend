/**
 * WXD Agent工作流
 * 参照API_DESIGN.md Agent架构规范
 * 
 * 工作流节点：
 * 1. parse_task - 任务解析
 * 2. load_memory - 加载记忆
 * 3. retrieve - 向量检索
 * 4. generate_outline - 大纲生成
 * 5. write_content - 内容撰写
 * 6. polish - 风格润色
 * 7. save - 保存结果
 */

import type {
  AgentState,
  WritingTask,
  DocumentOutline,
  OutlineSection,
  WritingResult,
  WritingStatus,
  UserMemory,
  RetrievedContext,
} from './types/index.ts';
import { callKimiAPI, streamKimiAPI } from '../llm/service.ts';
import {
  getOutlinePrompt,
  getOutlineSystemRole,
  getWritingPrompt,
  getWritingSystemRole,
  getPolishPrompt,
  getPolishSystemRole,
  buildPromptVariables,
} from './prompts/index.ts';

// ===== 状态管理 =====

/**
 * 初始化Agent状态
 */
export function createInitialState(task: WritingTask): AgentState {
  return {
    task,
    currentSectionIndex: 0,
    generatedContent: '',
    status: 'pending',
    logs: [],
  };
}

/**
 * 添加日志
 */
function addLog(state: AgentState, node: string, message: string, level: AgentState['logs'][0]['level'] = 'info', data?: any): void {
  state.logs.push({
    timestamp: new Date(),
    level,
    node,
    message,
    data,
  });
}

/**
 * 更新状态
 */
function updateStatus(state: AgentState, status: WritingStatus, error?: string): void {
  state.status = status;
  if (error) {
    state.error = error;
  }
}

// ===== 工作流节点 =====

/**
 * 节点1: 任务解析
 */
export async function parseTaskNode(state: AgentState): Promise<void> {
  addLog(state, 'parse_task', '开始解析任务');
  
  try {
    const { task } = state;
    
    // 验证必填字段
    if (!task.type || !task.topic || !task.from || !task.to) {
      throw new Error('任务缺少必填字段');
    }
    
    // 设置默认值
    if (!task.wordCount) {
      task.wordCount = 2000;
    }
    
    addLog(state, 'parse_task', '任务解析完成', 'info', {
      type: task.type,
      topic: task.topic,
      wordCount: task.wordCount,
    });
    
    updateStatus(state, 'parsing');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '任务解析失败';
    addLog(state, 'parse_task', errorMsg, 'error');
    updateStatus(state, 'error', errorMsg);
    throw error;
  }
}

/**
 * 节点2: 加载记忆
 */
export async function loadMemoryNode(state: AgentState): Promise<void> {
  addLog(state, 'load_memory', '开始加载用户记忆');
  
  try {
    // MVP阶段使用默认记忆
    const memory: UserMemory = {
      userId: 'default',
      preferences: {
        favoriteStyles: [],
        commonPhrases: [],
        preferredFormality: 3,
      },
      history: {
        recentTopics: [],
        recentDocuments: [],
      },
    };
    
    state.memory = memory;
    
    addLog(state, 'load_memory', '用户记忆加载完成');
    updateStatus(state, 'loading_memory');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '加载记忆失败';
    addLog(state, 'load_memory', errorMsg, 'error');
    // 记忆加载失败不阻断流程
    state.memory = undefined;
  }
}

/**
 * 节点3: 向量检索
 */
export async function retrieveNode(state: AgentState): Promise<void> {
  addLog(state, 'retrieve', '开始向量检索');
  
  try {
    const { task } = state;
    const contexts: RetrievedContext[] = [];
    
    // 如果有语料ID，加载对应的语料内容
    if (task.corpusIds && task.corpusIds.length > 0) {
      addLog(state, 'retrieve', `加载 ${task.corpusIds.length} 个语料`);
      
      for (const corpusId of task.corpusIds) {
        contexts.push({
          id: corpusId,
          type: 'corpus',
          title: `参考语料 ${corpusId}`,
          content: '这是参考语料的内容...',
          relevance: 0.85,
        });
      }
    }
    
    state.retrievedContext = contexts;
    
    addLog(state, 'retrieve', `检索完成，找到 ${contexts.length} 条上下文`);
    updateStatus(state, 'retrieving');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '向量检索失败';
    addLog(state, 'retrieve', errorMsg, 'error');
    state.retrievedContext = [];
  }
}

/**
 * 节点4: 生成大纲
 */
export async function generateOutlineNode(state: AgentState): Promise<void> {
  addLog(state, 'generate_outline', '开始生成大纲');
  
  try {
    const { task, memory, retrievedContext } = state;
    
    // 构建prompt变量
    const variables = buildPromptVariables(task, {
      memory,
      context: retrievedContext,
    });
    
    // 获取大纲生成prompt
    const prompt = getOutlinePrompt(variables);
    const systemRole = getOutlineSystemRole();
    
    // 调用Kimi API
    const response = await callKimiAPI([
      { role: 'system', content: systemRole },
      { role: 'user', content: prompt },
    ]);
    
    // 解析JSON响应
    let outlineData: any;
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                        response.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, response];
      const jsonStr = jsonMatch[1] || response;
      outlineData = JSON.parse(jsonStr.trim());
    } catch (e) {
      console.error('[generate_outline] JSON解析失败:', response);
      throw new Error('大纲解析失败，返回格式不正确');
    }
    
    // 构建大纲对象
    const outline: DocumentOutline = {
      id: `outline_${Date.now()}`,
      title: outlineData.title || task.topic,
      sections: outlineData.sections || [],
      totalWords: outlineData.totalWords || task.wordCount || 2000,
      confirmed: false,
      taskId: task.id,
    };
    
    state.outline = outline;
    
    addLog(state, 'generate_outline', '大纲生成完成', 'info', {
      title: outline.title,
      sectionCount: outline.sections.length,
      totalWords: outline.totalWords,
    });
    
    updateStatus(state, 'outline_pending_confirmation');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '大纲生成失败';
    addLog(state, 'generate_outline', errorMsg, 'error');
    updateStatus(state, 'error', errorMsg);
    throw error;
  }
}

/**
 * 节点5: 内容撰写（单段）
 */
export async function writeSectionNode(state: AgentState, sectionIndex: number): Promise<string> {
  const { task, outline, memory, retrievedContext, generatedContent } = state;
  
  if (!outline) {
    throw new Error('大纲不存在');
  }
  
  const section = outline.sections[sectionIndex];
  if (!section) {
    throw new Error(`章节 ${sectionIndex} 不存在`);
  }
  
  addLog(state, 'write_content', `撰写第 ${sectionIndex + 1}/${outline.sections.length} 部分: ${section.title}`);
  
  // 构建prompt变量
  const variables = buildPromptVariables(task, {
    outline,
    section,
    memory,
    context: retrievedContext,
    content: generatedContent,
  });
  
  // 获取撰写prompt
  const prompt = getWritingPrompt(variables);
  const systemRole = getWritingSystemRole(task.type);
  
  // 调用Kimi API
  const sectionContent = await callKimiAPI([
    { role: 'system', content: systemRole },
    { role: 'user', content: prompt },
  ]);
  
  addLog(state, 'write_content', `第 ${sectionIndex + 1} 部分撰写完成`, 'info', {
    sectionTitle: section.title,
    contentLength: sectionContent.length,
  });
  
  return sectionContent;
}

/**
 * 节点6: 风格润色
 */
export async function polishNode(state: AgentState): Promise<void> {
  addLog(state, 'polish', '开始风格润色');
  
  try {
    const { task, generatedContent } = state;
    
    if (!generatedContent) {
      throw new Error('没有内容可润色');
    }
    
    // 构建prompt变量
    const variables = buildPromptVariables(task, {
      content: generatedContent,
    });
    
    // 获取润色prompt（使用正常级别）
    const prompt = getPolishPrompt(variables, 'normal');
    const systemRole = getPolishSystemRole('normal');
    
    // 调用Kimi API
    const polishedContent = await callKimiAPI([
      { role: 'system', content: systemRole },
      { role: 'user', content: prompt },
    ]);
    
    state.generatedContent = polishedContent;
    
    addLog(state, 'polish', '风格润色完成', 'info', {
      originalLength: generatedContent.length,
      polishedLength: polishedContent.length,
    });
    
    updateStatus(state, 'completed');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '风格润色失败';
    addLog(state, 'polish', errorMsg, 'error');
    // 润色失败不阻断流程，保留原文
    updateStatus(state, 'completed');
  }
}

/**
 * 节点7: 保存结果
 */
export async function saveNode(state: AgentState): Promise<void> {
  addLog(state, 'save', '保存写作结果');
  
  try {
    // TODO: 将结果保存到数据库
    addLog(state, 'save', '结果保存完成');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '保存失败';
    addLog(state, 'save', errorMsg, 'error');
  }
}

// ===== 顺序执行工作流 =====

/**
 * 执行完整写作流程
 */
export async function executeWriting(state: AgentState): Promise<WritingResult> {
  const startTime = Date.now();
  
  // 1. 解析任务
  await parseTaskNode(state);
  
  // 2. 加载记忆
  await loadMemoryNode(state);
  
  // 3. 向量检索
  await retrieveNode(state);
  
  // 4. 生成大纲
  await generateOutlineNode(state);
  
  // 5. 分段撰写
  if (state.outline) {
    updateStatus(state, 'writing');
    
    for (let i = 0; i < state.outline.sections.length; i++) {
      const sectionContent = await writeSectionNode(state, i);
      
      // 累加内容
      if (state.generatedContent) {
        state.generatedContent += '\n\n' + sectionContent;
      } else {
        state.generatedContent = sectionContent;
      }
      
      state.currentSectionIndex = i + 1;
    }
  }
  
  // 6. 风格润色
  await polishNode(state);
  
  // 7. 保存
  await saveNode(state);
  
  // 返回结果
  const result: WritingResult = {
    taskId: state.task.id,
    title: state.outline?.title || state.task.topic,
    content: state.generatedContent,
    outline: state.outline!,
    metadata: {
      model: 'moonshot-v1-8k',
      totalTokens: 0,
      generationTime: Date.now() - startTime,
      sectionsCount: state.outline?.sections.length || 0,
    },
  };
  
  return result;
}

// ===== 流式写作 =====

/**
 * 流式写作生成器
 */
export async function* streamWriting(
  task: WritingTask,
  onOutlineGenerated?: (outline: DocumentOutline) => Promise<boolean>
): AsyncGenerator<{ type: string; data?: any; message?: string }, WritingResult, unknown> {
  const state = createInitialState(task);
  const startTime = Date.now();
  
  try {
    // 1. 解析任务
    yield { type: 'parsing', message: '正在解析任务...' };
    await parseTaskNode(state);
    yield { type: 'task_parsed', data: { task } };
    
    // 2. 加载记忆
    yield { type: 'loading_memory', message: '正在加载用户偏好...' };
    await loadMemoryNode(state);
    yield { type: 'memory_loaded' };
    
    // 3. 向量检索
    yield { type: 'retrieving', message: '正在检索相关资料...' };
    await retrieveNode(state);
    yield { type: 'context_retrieved', data: { count: state.retrievedContext?.length || 0 } };
    
    // 4. 生成大纲
    yield { type: 'generating_outline', message: '正在生成大纲...' };
    await generateOutlineNode(state);
    
    if (state.outline) {
      yield { type: 'outline_generated', data: { outline: state.outline } };
      
      // 等待用户确认大纲
      if (onOutlineGenerated) {
        const confirmed = await onOutlineGenerated(state.outline);
        if (!confirmed) {
          yield { type: 'cancelled', message: '用户取消写作' };
          throw new Error('用户取消写作');
        }
      }
      
      yield { type: 'outline_confirmed' };
    }
    
    // 5. 分段撰写
    if (state.outline) {
      updateStatus(state, 'writing');
      
      for (let i = 0; i < state.outline.sections.length; i++) {
        const section = state.outline.sections[i];
        yield {
          type: 'section_writing',
          message: `正在撰写第 ${i + 1}/${state.outline.sections.length} 部分: ${section.title}...`,
          data: { current: i + 1, total: state.outline.sections.length, section },
        };
        
        // 使用流式生成
        const variables = buildPromptVariables(task, {
          outline: state.outline,
          section,
          memory: state.memory,
          context: state.retrievedContext,
          content: state.generatedContent,
        });
        
        const prompt = getWritingPrompt(variables);
        const systemRole = getWritingSystemRole(task.type);
        
        let sectionContent = '';
        for await (const event of streamKimiAPI([
          { role: 'system', content: systemRole },
          { role: 'user', content: prompt },
        ])) {
          if (event.type === 'chunk') {
            sectionContent = event.data?.fullContent || '';
            yield { type: 'chunk', data: { section: i, content: event.data?.content } };
          }
        }
        
        // 累加内容
        if (state.generatedContent) {
          state.generatedContent += '\n\n' + sectionContent;
        } else {
          state.generatedContent = sectionContent;
        }
        
        state.currentSectionIndex = i + 1;
        
        yield {
          type: 'section_completed',
          data: { section: i, title: section.title },
        };
      }
    }
    
    // 6. 风格润色
    yield { type: 'polishing', message: '正在进行风格润色...' };
    await polishNode(state);
    
    // 7. 保存
    yield { type: 'saving', message: '正在保存文档...' };
    await saveNode(state);
    
    // 8. 完成
    yield { type: 'completed', message: '写作完成！' };
    
    // 返回结果
    const result: WritingResult = {
      taskId: task.id,
      title: state.outline?.title || task.topic,
      content: state.generatedContent,
      outline: state.outline!,
      metadata: {
        model: 'moonshot-v1-8k',
        totalTokens: 0,
        generationTime: Date.now() - startTime,
        sectionsCount: state.outline?.sections.length || 0,
      },
    };
    
    return result;
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '写作失败';
    yield { type: 'error', message: errorMsg };
    throw error;
  }
}

/**
 * 创建写作Agent（简化版，直接执行）
 */
export function createWritingAgent() {
  return {
    invoke: async (state: AgentState) => {
      return executeWriting(state);
    },
  };
}
