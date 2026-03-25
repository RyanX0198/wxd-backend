#!/usr/bin/env node
/**
 * WXD CLI - 命令行写作工具
 * 
 * 用法：
 *   wxd write "任务描述"           # 创建写作任务
 *   wxd write --interactive       # 交互式写作
 *   wxd status <taskId>           # 查看任务状态
 *   wxd list                      # 列出任务列表
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = process.env.WXD_API_URL || 'http://localhost:3001';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function print(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function printHeader(title: string) {
  console.log('');
  print('═'.repeat(60), 'cyan');
  print(`  ${title}`, 'bright');
  print('═'.repeat(60), 'cyan');
  console.log('');
}

// 解析任务描述
function parseTaskDescription(description: string) {
  // 简单解析：尝试提取类型、主题
  const typePatterns = [
    { pattern: /讲话稿|演讲稿|发言稿/, type: '讲话稿' },
    { pattern: /通知|活动通知|会议通知/, type: '活动通知' },
    { pattern: /总结|工作总结|年终总结/, type: '工作总结' },
    { pattern: /请示|申请|呈报/, type: '请示' },
    { pattern: /报告|汇报|情况报告/, type: '报告' },
    { pattern: /批复|回复|答复/, type: '批复' },
    { pattern: /函|信函|公函/, type: '函' },
    { pattern: /纪要|会议记录|备忘录/, type: '纪要' },
  ];
  
  let detectedType = '讲话稿'; // 默认
  for (const { pattern, type } of typePatterns) {
    if (pattern.test(description)) {
      detectedType = type;
      break;
    }
  }
  
  return {
    type: detectedType,
    topic: description,
    from: '本单位',
    to: '全体人员',
  };
}

// 创建写作任务
async function createWritingTask(description: string, options: any = {}) {
  printHeader('WXD 智能写作助手');
  print('正在分析任务...', 'dim');
  
  const taskData = parseTaskDescription(description);
  
  // 应用选项覆盖
  if (options.type) taskData.type = options.type;
  if (options.from) taskData.from = options.from;
  if (options.to) taskData.to = options.to;
  if (options.wordCount) taskData.wordCount = parseInt(options.wordCount);
  
  print(`\n📋 任务信息：`, 'bright');
  print(`  文种类型: ${taskData.type}`, 'blue');
  print(`  主题: ${taskData.topic}`, 'blue');
  print(`  发文单位: ${taskData.from}`, 'blue');
  print(`  主送对象: ${taskData.to}`, 'blue');
  if (taskData.wordCount) {
    print(`  字数要求: ${taskData.wordCount}字`, 'blue');
  }
  
  print('\n🚀 创建写作任务...', 'yellow');
  
  try {
    const response = await fetch(`${API_BASE}/api/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    const taskId = result.data.taskId;
    
    print(`✅ 任务创建成功: ${taskId}`, 'green');
    print(`\n📝 开始写作流程...\n`, 'cyan');
    
    // 开始流式获取
    await streamWriting(taskId);
    
  } catch (error) {
    print(`❌ 创建任务失败: ${error instanceof Error ? error.message : '未知错误'}`, 'red');
    process.exit(1);
  }
}

// 流式写作
async function streamWriting(taskId: string) {
  const eventSource = new EventSource(`${API_BASE}/api/write/${taskId}/stream`);
  
  let fullContent = '';
  let outline: any = null;
  
  return new Promise((resolve, reject) => {
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'start':
            print('🚀 开始写作...', 'cyan');
            break;
            
          case 'parsing':
            print('📋 解析任务...', 'dim');
            break;
            
          case 'loading_memory':
            print('🧠 加载用户偏好...', 'dim');
            break;
            
          case 'retrieving':
            print('🔍 检索相关资料...', 'dim');
            break;
            
          case 'generating_outline':
            print('📑 生成大纲...', 'dim');
            break;
            
          case 'outline_generated':
            outline = data.data.outline;
            print('\n📋 大纲已生成：', 'bright');
            print(`标题: ${outline.title}`, 'blue');
            print('结构：', 'blue');
            outline.sections.forEach((section: any, index: number) => {
              print(`  ${index + 1}. ${section.title}`, 'cyan');
            });
            print('\n⏳ 继续撰写内容...\n', 'yellow');
            break;
            
          case 'section_writing':
            print(`📝 ${data.message}`, 'dim');
            break;
            
          case 'chunk':
            // 流式内容（暂不显示，最后一起输出）
            break;
            
          case 'section_completed':
            print(`✅ 完成: ${data.data.title}`, 'green');
            break;
            
          case 'polishing':
            print('\n✨ 正在进行风格润色...', 'magenta');
            break;
            
          case 'completed':
            fullContent = data.data.content;
            print('\n' + '═'.repeat(60), 'green');
            print('✅ 写作完成！', 'bright');
            print('═'.repeat(60) + '\n', 'green');
            
            // 输出结果
            print('📄 生成内容：\n', 'bright');
            console.log(fullContent);
            
            // 保存到文件
            const filename = `output_${taskId.slice(0, 8)}.txt`;
            fs.writeFileSync(filename, fullContent);
            print(`\n💾 已保存到: ${filename}`, 'green');
            
            eventSource.close();
            resolve(fullContent);
            break;
            
          case 'error':
            print(`\n❌ 错误: ${data.message}`, 'red');
            eventSource.close();
            reject(new Error(data.message));
            break;
        }
      } catch (e) {
        // 忽略解析错误
      }
    };
    
    eventSource.onerror = (error) => {
      print('\n❌ 连接错误', 'red');
      eventSource.close();
      reject(error);
    };
  });
}

// 查看任务状态
async function checkStatus(taskId: string) {
  printHeader('任务状态');
  
  try {
    const response = await fetch(`${API_BASE}/api/write/${taskId}`);
    const result = await response.json();
    
    if (!result.success) {
      print(`❌ ${result.error.message}`, 'red');
      return;
    }
    
    const { task, progress, outline } = result.data;
    
    print(`📋 任务ID: ${taskId}`, 'bright');
    print(`📝 类型: ${task.type}`, 'blue');
    print(`📌 主题: ${task.topic}`, 'blue');
    print(`📊 状态: ${progress?.status || 'pending'}`, 'yellow');
    
    if (progress?.progress) {
      const bar = '█'.repeat(Math.floor(progress.progress / 5)) + '░'.repeat(20 - Math.floor(progress.progress / 5));
      print(`⏳ 进度: [${bar}] ${progress.progress}%`, 'cyan');
    }
    
    if (outline) {
      print('\n📑 大纲:', 'bright');
      outline.sections.forEach((section: any, index: number) => {
        print(`  ${index + 1}. ${section.title}`, 'cyan');
      });
    }
    
  } catch (error) {
    print(`❌ 查询失败: ${error instanceof Error ? error.message : '未知错误'}`, 'red');
  }
}

// 列出任务
async function listTasks() {
  printHeader('任务列表');
  
  try {
    const response = await fetch(`${API_BASE}/api/write`);
    const result = await response.json();
    
    if (!result.success || result.data.length === 0) {
      print('暂无任务', 'dim');
      return;
    }
    
    result.data.forEach((task: any, index: number) => {
      print(`${index + 1}. [${task.type}] ${task.topic}`, 'blue');
      print(`   ID: ${task.taskId} | 状态: ${task.status}`, 'dim');
      print(`   创建: ${new Date(task.createdAt).toLocaleString()}`, 'dim');
      console.log('');
    });
    
  } catch (error) {
    print(`❌ 查询失败: ${error instanceof Error ? error.message : '未知错误'}`, 'red');
  }
}

// 交互式写作
async function interactiveWriting() {
  printHeader('交互式写作模式');
  
  // 这里需要readline或其他交互库
  // MVP阶段简化处理
  print('交互式模式需要额外的依赖，请使用:', 'yellow');
  print('  wxd write "任务描述"', 'cyan');
  print('\n示例：', 'bright');
  print('  wxd write "写一篇关于教育改革的讲话稿"', 'dim');
}

// 显示帮助
function showHelp() {
  printHeader('WXD CLI - 智能写作助手');
  
  print('用法：', 'bright');
  print('  wxd write <任务描述> [选项]    创建写作任务', 'cyan');
  print('  wxd status <taskId>              查看任务状态', 'cyan');
  print('  wxd list                          列出所有任务', 'cyan');
  print('  wxd --help                        显示帮助信息', 'cyan');
  
  print('\n选项：', 'bright');
  print('  --type <type>      文种类型 (讲话稿|通知|总结|请示|报告|批复|函|纪要)', 'blue');
  print('  --from <from>      发文单位', 'blue');
  print('  --to <to>          主送对象', 'blue');
  print('  --words <num>      字数要求', 'blue');
  print('  --interactive      交互式模式', 'blue');
  
  print('\n示例：', 'bright');
  print('  wxd write "写一篇关于教育改革的讲话稿"', 'dim');
  print('  wxd write "年终工作总结" --type 工作总结 --words 3000', 'dim');
  print('  wxd status abc-123-def', 'dim');
  
  print('\n环境变量：', 'bright');
  print('  WXD_API_URL        API地址 (默认: http://localhost:3001)', 'blue');
  print('  KIMI_API_KEY       Kimi API密钥', 'blue');
  
  console.log('');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    return;
  }
  
  const command = args[0];
  
  switch (command) {
    case 'write':
      const description = args[1];
      if (!description || description.startsWith('--')) {
        print('❌ 请提供任务描述', 'red');
        showHelp();
        process.exit(1);
      }
      
      // 解析选项
      const options: any = {};
      for (let i = 2; i < args.length; i++) {
        switch (args[i]) {
          case '--type':
            options.type = args[++i];
            break;
          case '--from':
            options.from = args[++i];
            break;
          case '--to':
            options.to = args[++i];
            break;
          case '--words':
            options.wordCount = args[++i];
            break;
          case '--interactive':
            await interactiveWriting();
            return;
        }
      }
      
      await createWritingTask(description, options);
      break;
      
    case 'status':
      const taskId = args[1];
      if (!taskId) {
        print('❌ 请提供任务ID', 'red');
        process.exit(1);
      }
      await checkStatus(taskId);
      break;
      
    case 'list':
      await listTasks();
      break;
      
    default:
      print(`❌ 未知命令: ${command}`, 'red');
      showHelp();
      process.exit(1);
  }
}

main().catch(error => {
  console.error('错误:', error);
  process.exit(1);
});
