/**
 * WXD Agent 核心类型定义
 * 参照API_DESIGN.md 类型规范
 */

// 文档类型
export type DocumentType = 
  | '讲话稿' 
  | '活动通知' 
  | '工作总结' 
  | '请示' 
  | '报告' 
  | '批复' 
  | '函' 
  | '纪要';

// 任务定义
export interface WritingTask {
  id: string;
  type: DocumentType;
  topic: string;
  from: string;
  to: string;
  wordCount?: number;
  formality?: number; // 1-5
  urgency?: number; // 1-3
  style?: string;
  requirements?: string[];
  corpusIds?: string[];
  createdAt: Date;
}

// 大纲结构
export interface OutlineSection {
  id: string;
  title: string;
  content?: string;
  subsections?: OutlineSection[];
  estimatedWords?: number;
}

export interface DocumentOutline {
  id: string;
  title: string;
  sections: OutlineSection[];
  totalWords: number;
  confirmed: boolean;
  taskId: string;
}

// 写作状态
export type WritingStatus = 
  | 'pending' 
  | 'parsing' 
  | 'loading_memory' 
  | 'retrieving'
  | 'generating_outline'
  | 'outline_pending_confirmation'
  | 'writing'
  | 'polishing'
  | 'completed'
  | 'error';

// Agent状态
export interface AgentState {
  task: WritingTask;
  outline?: DocumentOutline;
  currentSectionIndex: number;
  generatedContent: string;
  memory?: UserMemory;
  retrievedContext?: RetrievedContext[];
  status: WritingStatus;
  error?: string;
  logs: AgentLog[];
}

// 用户记忆
export interface UserMemory {
  userId: string;
  preferences: {
    favoriteStyles: string[];
    commonPhrases: string[];
    preferredFormality: number;
  };
  history: {
    recentTopics: string[];
    recentDocuments: string[];
  };
}

// 检索上下文
export interface RetrievedContext {
  id: string;
  type: 'corpus' | 'template' | 'knowledge';
  title: string;
  content: string;
  relevance: number;
  source?: string;
}

// Agent日志
export interface AgentLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  node: string;
  message: string;
  data?: any;
}

// 流式输出事件
export type StreamEventType = 
  | 'start' 
  | 'task_parsed' 
  | 'memory_loaded' 
  | 'context_retrieved'
  | 'outline_generated'
  | 'outline_confirmed'
  | 'section_writing'
  | 'section_completed'
  | 'polishing'
  | 'completed'
  | 'error'
  | 'chunk';

export interface StreamEvent {
  type: StreamEventType;
  data?: any;
  message?: string;
  timestamp: Date;
}

// 写作结果
export interface WritingResult {
  taskId: string;
  title: string;
  content: string;
  outline: DocumentOutline;
  metadata: {
    model: string;
    totalTokens: number;
    generationTime: number;
    sectionsCount: number;
  };
}

// LLM配置
export interface LLMConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  streaming: boolean;
}

// Prompt模板变量
export interface PromptVariables {
  task: WritingTask;
  outline?: DocumentOutline;
  section?: OutlineSection;
  memory?: UserMemory;
  context?: RetrievedContext[];
  styleGuide?: StyleGuide;
  content?: string;
}

// 风格指南
export interface StyleGuide {
  formality: number;
  tone: string;
  forbiddenWords: string[];
  preferredWords: string[];
  sentenceStructure: string;
}

// API请求/响应类型
export interface CreateWritingTaskRequest {
  type: DocumentType;
  topic: string;
  from: string;
  to: string;
  wordCount?: number;
  formality?: number;
  urgency?: number;
  requirements?: string[];
  corpusIds?: string[];
}

export interface ConfirmOutlineRequest {
  taskId: string;
  confirmed: boolean;
  modifications?: {
    sectionId: string;
    changes: Partial<OutlineSection>;
  }[];
}

export interface WritingProgress {
  taskId: string;
  status: WritingStatus;
  currentSection?: number;
  totalSections?: number;
  currentContent?: string;
  progress: number; // 0-100
}
