/**
 * 写作API路由
 * 参照API_DESIGN.md REST规范和流式输出规范
 * 
 * 功能：
 * - POST /api/write - 创建写作任务
 * - GET /api/write/:id/stream - 流式获取内容
 * - WebSocket实时推送
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { 
  WritingTask, 
  DocumentOutline, 
  WritingResult,
  CreateWritingTaskRequest,
  ConfirmOutlineRequest,
  WritingProgress 
} from '../../core/types/index.ts';
import { createWritingAgent, streamWriting, createInitialState } from '../../core/agent.ts';

const router = Router();

// 内存存储（生产环境应使用Redis）
const taskStore: Map<string, WritingTask> = new Map();
const outlineStore: Map<string, DocumentOutline> = new Map();
const resultStore: Map<string, WritingResult> = new Map();
const progressStore: Map<string, WritingProgress> = new Map();
const streamListeners: Map<string, Set<(streamEvent: any) => void>> = new Map();

/**
 * 创建写作任务
 * POST /api/write
 */
router.post('/', async (req, res) => {
  try {
    const { 
      type, 
      topic, 
      from, 
      to, 
      wordCount, 
      formality, 
      urgency,
      requirements,
      corpusIds 
    }: CreateWritingTaskRequest = req.body;
    
    // 验证必填字段
    if (!type || !topic || !from || !to) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALID_MISSING_FIELD',
          message: '缺少必填字段：type, topic, from, to',
        },
      });
    }
    
    // 验证文种类型
    const validTypes = ['讲话稿', '活动通知', '工作总结', '请示', '报告', '批复', '函', '纪要'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALID_INVALID_FORMAT',
          message: `不支持的文种类型：${type}。支持的类型：${validTypes.join('、')}`,
        },
      });
    }
    
    // 创建任务
    const taskId = uuidv4();
    const task: WritingTask = {
      id: taskId,
      type,
      topic,
      from,
      to,
      wordCount,
      formality,
      urgency,
      requirements,
      corpusIds,
      createdAt: new Date(),
    };
    
    // 保存任务
    taskStore.set(taskId, task);
    
    // 初始化进度
    const progress: WritingProgress = {
      taskId,
      status: 'pending',
      progress: 0,
    };
    progressStore.set(taskId, progress);
    
    // 初始化流监听器
    streamListeners.set(taskId, new Set());
    
    console.log(`[WriteAPI] 创建写作任务: ${taskId}`);
    
    res.status(201).json({
      success: true,
      data: {
        taskId,
        task,
        streamUrl: `/api/write/${taskId}/stream`,
        status: 'pending',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('[WriteAPI] 创建任务失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SYS_INTERNAL_ERROR',
        message: '创建写作任务失败',
      },
    });
  }
});

/**
 * 获取任务状态
 * GET /api/write/:id
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const task = taskStore.get(id);
  
  if (!task) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'RES_NOT_FOUND',
        message: '写作任务不存在',
      },
    });
  }
  
  const progress = progressStore.get(id);
  const result = resultStore.get(id);
  const outline = outlineStore.get(id);
  
  res.json({
    success: true,
    data: {
      task,
      progress,
      outline,
      result: result ? {
        taskId: result.taskId,
        title: result.title,
        metadata: result.metadata,
      } : undefined,
    },
  });
});

/**
 * 流式获取写作进度
 * GET /api/write/:id/stream
 * SSE (Server-Sent Events)
 */
router.get('/:id/stream', async (req, res) => {
  const { id } = req.params;
  const task = taskStore.get(id);
  
  if (!task) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'RES_NOT_FOUND',
        message: '写作任务不存在',
      },
    });
  }
  
  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  
  console.log(`[WriteAPI] 开始流式输出: ${id}`);
  
  // 发送开始事件
  res.write(`data: ${JSON.stringify({
    type: 'start',
    message: '开始写作流程',
    timestamp: new Date().toISOString(),
  })}\n\n`);
  
  try {
    // 检查是否已有结果（从缓存）
    const cachedResult = resultStore.get(id);
    if (cachedResult) {
      res.write(`data: ${JSON.stringify({
        type: 'completed',
        data: {
          taskId: cachedResult.taskId,
          title: cachedResult.title,
          content: cachedResult.content,
          metadata: cachedResult.metadata,
        },
        timestamp: new Date().toISOString(),
      })}\n\n`);
      res.end();
      return;
    }
    
    // 开始流式写作
    const writingGenerator = streamWriting(task, async (outline: DocumentOutline) => {
      // 保存大纲
      outlineStore.set(id, outline);
      
      // 发送大纲生成事件
      res.write(`data: ${JSON.stringify({
        type: 'outline_generated',
        data: { outline },
        timestamp: new Date().toISOString(),
      })}\n\n`);
      
      // 在MVP阶段，自动确认大纲
      // 生产环境应等待用户确认
      return true;
    });
    
    let result: WritingResult | undefined;
    
    for await (const event of writingGenerator) {
      // 更新进度
      const progress = progressStore.get(id);
      if (progress) {
        progress.status = event.type as any;
        if (event.data?.current && event.data?.total) {
          progress.currentSection = event.data.current;
          progress.totalSections = event.data.total;
          progress.progress = Math.round((event.data.current / event.data.total) * 100);
        }
        progressStore.set(id, progress);
      }
      
      // 发送事件
      res.write(`data: ${JSON.stringify({
        ...event,
        timestamp: new Date().toISOString(),
      })}\n\n`);
      
      // 通知所有监听器
      const listeners = streamListeners.get(id);
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
    }
    
    // 获取最终结果
    const returnResult = await writingGenerator.return?.();
    result = returnResult?.value as WritingResult | undefined;
    
    if (result) {
      // 保存结果
      resultStore.set(id, result);
      
      // 发送完成事件
      res.write(`data: ${JSON.stringify({
        type: 'completed',
        data: {
          taskId: result.taskId,
          title: result.title,
          content: result.content,
          metadata: result.metadata,
        },
        timestamp: new Date().toISOString(),
      })}\n\n`);
    }
    
    res.end();
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '写作失败';
    console.error(`[WriteAPI] 流式写作失败: ${id}`, error);
    
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: errorMsg,
      timestamp: new Date().toISOString(),
    })}\n\n`);
    
    res.end();
  }
});

/**
 * 确认/修改大纲
 * POST /api/write/:id/outline/confirm
 */
router.post('/:id/outline/confirm', async (req, res) => {
  const { id } = req.params;
  const { confirmed, modifications }: ConfirmOutlineRequest = req.body;
  
  const task = taskStore.get(id);
  const outline = outlineStore.get(id);
  
  if (!task || !outline) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'RES_NOT_FOUND',
        message: '任务或大纲不存在',
      },
    });
  }
  
  if (!confirmed) {
    return res.json({
      success: true,
      data: {
        message: '大纲已拒绝，可重新生成',
        status: 'outline_rejected',
      },
    });
  }
  
  // 应用修改
  if (modifications && modifications.length > 0) {
    for (const mod of modifications) {
      const section = outline.sections.find((s: any) => s.id === mod.sectionId);
      if (section) {
        Object.assign(section, mod.changes);
      }
    }
    outlineStore.set(id, outline);
  }
  
  // 标记大纲已确认
  outline.confirmed = true;
  outlineStore.set(id, outline);
  
  res.json({
    success: true,
    data: {
      message: '大纲已确认',
      outline,
      status: 'outline_confirmed',
    },
  });
});

/**
 * 重新生成大纲
 * POST /api/write/:id/outline/regenerate
 */
router.post('/:id/outline/regenerate', async (req, res) => {
  const { id } = req.params;
  const { feedback }: { feedback?: string } = req.body;
  
  const task = taskStore.get(id);
  
  if (!task) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'RES_NOT_FOUND',
        message: '任务不存在',
      },
    });
  }
  
  // TODO: 根据反馈重新生成大纲
  // MVP阶段直接删除旧大纲，下次stream时会重新生成
  outlineStore.delete(id);
  
  res.json({
    success: true,
    data: {
      message: '大纲已重置，请重新获取stream',
      status: 'outline_reset',
    },
  });
});

/**
 * 获取写作结果
 * GET /api/write/:id/result
 */
router.get('/:id/result', (req, res) => {
  const { id } = req.params;
  const result = resultStore.get(id);
  
  if (!result) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'RES_NOT_FOUND',
        message: '写作结果不存在，可能尚未完成',
      },
    });
  }
  
  res.json({
    success: true,
    data: result,
  });
});

/**
 * 取消写作任务
 * DELETE /api/write/:id
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  // 清理存储
  taskStore.delete(id);
  outlineStore.delete(id);
  resultStore.delete(id);
  progressStore.delete(id);
  streamListeners.delete(id);
  
  res.json({
    success: true,
    data: {
      message: '任务已取消',
    },
  });
});

/**
 * 获取任务列表
 * GET /api/write
 */
router.get('/', (req, res) => {
  const tasks = Array.from(taskStore.values()).map(task => ({
    taskId: task.id,
    type: task.type,
    topic: task.topic,
    status: progressStore.get(task.id)?.status || 'pending',
    createdAt: task.createdAt,
  }));
  
  res.json({
    success: true,
    data: tasks,
  });
});

export default router;
