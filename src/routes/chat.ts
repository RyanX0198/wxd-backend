import { Router } from 'express';
import { mockDB } from '../mockDB.ts';

const router = Router();

// DeepSeek API配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-cb6715bc91a34415b607191c0c0bbb6b';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

// ===== 对话管理 =====

// POST /api/chat/conversations - 创建对话
router.post('/conversations', async (req, res) => {
  try {
    const { title = '新对话', type = 'general', userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: '缺少用户ID' });
    }

    const conversation = await mockDB.createConversation(userId, title, type);
    
    res.json({
      success: true,
      data: conversation
    });
  } catch (error: any) {
    console.error('创建对话失败:', error);
    res.status(500).json({ error: '创建对话失败', message: error.message });
  }
});

// GET /api/chat/conversations - 获取对话列表
router.get('/conversations', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: '缺少用户ID' });
    }

    const conversations = await mockDB.getConversationsByUserId(userId as string);
    
    res.json({
      success: true,
      data: conversations
    });
  } catch (error: any) {
    console.error('获取对话列表失败:', error);
    res.status(500).json({ error: '获取对话列表失败', message: error.message });
  }
});

// GET /api/chat/conversations/:id - 获取对话详情
router.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const conversation = await mockDB.getConversationById(id);
    if (!conversation) {
      return res.status(404).json({ error: '对话不存在' });
    }

    const messages = await mockDB.getMessagesByConversationId(id);
    
    res.json({
      success: true,
      data: {
        ...conversation,
        messages
      }
    });
  } catch (error: any) {
    console.error('获取对话详情失败:', error);
    res.status(500).json({ error: '获取对话详情失败', message: error.message });
  }
});

// DELETE /api/chat/conversations/:id - 删除对话
router.delete('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await mockDB.deleteConversation(id);
    
    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error: any) {
    console.error('删除对话失败:', error);
    res.status(500).json({ error: '删除对话失败', message: error.message });
  }
});

// ===== SSE 流式消息 =====

// POST /api/chat/messages/stream - 流式发送消息
router.post('/messages/stream', async (req, res) => {
  try {
    const { conversationId, content, userId } = req.body;
    
    if (!conversationId || !content) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 验证对话存在
    const conversation = await mockDB.getConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: '对话不存在' });
    }

    // 保存用户消息
    await mockDB.createMessage(conversationId, 'user', content);

    // 获取历史消息（用于上下文）
    const historyMessages = await mockDB.getMessagesByConversationId(conversationId);
    const messages = historyMessages.slice(-10).map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 构建系统提示词
    const systemPrompt = conversation.type === 'speech' 
      ? '你是一位资深的政府公文写作专家，专门协助用户撰写讲话稿。请根据用户需求提供专业的写作建议和内容生成。'
      : '你是一位资深的政府公文写作专家，擅长撰写各类教育政务公文。';

    // 调用 DeepSeek API (流式)
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 4000,
        stream: true
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API调用失败: ${errorData.error?.message || response.statusText}`);
    }

    // 处理流式响应
    let fullContent = '';
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('无法读取响应流');
    }

    // 发送开始事件
    res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            // 流结束
            break;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            
            if (delta) {
              fullContent += delta;
              // 发送内容片段
              res.write(`data: ${JSON.stringify({ type: 'chunk', content: delta })}\n\n`);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    // 保存AI回复到数据库
    await mockDB.createMessage(conversationId, 'assistant', fullContent);
    
    // 更新对话时间
    await mockDB.updateConversationTime(conversationId);

    // 发送结束事件
    res.write(`data: ${JSON.stringify({ type: 'end', messageId: 'msg_' + Date.now() })}\n\n`);
    res.end();

  } catch (error: any) {
    console.error('流式消息失败:', error);
    
    // 发送错误事件
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

// POST /api/chat/messages - 非流式发送消息（备用）
router.post('/messages', async (req, res) => {
  try {
    const { conversationId, content, userId } = req.body;
    
    if (!conversationId || !content) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 验证对话存在
    const conversation = await mockDB.getConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: '对话不存在' });
    }

    // 保存用户消息
    await mockDB.createMessage(conversationId, 'user', content);

    // 获取历史消息
    const historyMessages = await mockDB.getMessagesByConversationId(conversationId);
    const messages = historyMessages.slice(-10).map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));

    // 构建系统提示词
    const systemPrompt = conversation.type === 'speech' 
      ? '你是一位资深的政府公文写作专家，专门协助用户撰写讲话稿。'
      : '你是一位资深的政府公文写作专家。';

    // 调用 DeepSeek API (非流式)
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 4000,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API调用失败: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content || '';

    // 保存AI回复
    const aiMessage = await mockDB.createMessage(conversationId, 'assistant', aiContent);
    
    // 更新对话时间
    await mockDB.updateConversationTime(conversationId);

    res.json({
      success: true,
      data: aiMessage
    });

  } catch (error: any) {
    console.error('发送消息失败:', error);
    res.status(500).json({ error: '发送消息失败', message: error.message });
  }
});

export default router;
