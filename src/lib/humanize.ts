/**
 * 去AI味核心模块 - Humanize Module
 * 
 * 方案选择：提示词工程（方案1）
 * 理由：
 * 1. 实现简单，无需额外API调用
 * 2. 成本低、延迟低
 * 3. 通过精心设计prompt可达到很好效果
 * 4. 三种强度级别易于实现
 * 
 * 强度级别说明：
 * - light(轻度): 轻微口语化，保持公文基本结构
 * - medium(中度): 明显口语化，打破规整结构，添加自然停顿
 * - deep(深度): 完全拟人化，像资深公文写作者亲笔
 */

export type HumanizeLevel = 'none' | 'light' | 'medium' | 'deep';

/**
 * 获取去AI味的系统Prompt附加指令
 */
export function getHumanizePrompt(level: HumanizeLevel): string {
  if (level === 'none') {
    return '';
  }

  const prompts: Record<Exclude<HumanizeLevel, 'none'>, string> = {
    light: `【写作风格要求 - 轻度去AI味】
请在保持公文规范的基础上，进行以下微调：
1. 适当使用口语化连接词，如"那么"、"其实"、"总的来说"
2. 长短句搭配，避免过多排比句
3. 减少"首先/其次/再次/最后"的机械使用，改用更自然的过渡
4. 允许少量生活化表达，但保持庄重感`,

    medium: `【写作风格要求 - 中度去AI味】
请让文章更像一位经验丰富的公文写作者亲笔，而非AI生成：
1. 使用自然的口语化表达，如"咱们"、"说白了"、"说到底"、"实话讲"
2. 主动打破规整的段落结构，允许段落长短不一
3. 添加自然的停顿和思考痕迹，如"..."、"——"、"（）"
4. 减少套话和空话，直接切入重点
5. 使用"我们要"而非"我们应当"，使用"必须"而非"务必要"
6. 适当使用反问句、设问句增强互动感
7. 数据和例子要具体，避免泛泛而谈
8. 减少"高度重视""积极推进"等模板化用语`,

    deep: `【写作风格要求 - 深度去AI味】
你是一位有30年公文写作经验的老笔杆子。请用你的人格和风格来写作：
1. 完全口语化，像在面对面对话，如"说句实在话"、"不瞒你说"、"咱们直奔主题"
2. 段落结构自然随意，有时一句话成段，有时长段叙述
3. 大量使用口语停顿："这个..."、"怎么说呢..."、"啊"、"嘛"、"吧"
4. 主动使用括号补充个人思考，如"（这点很重要）"、"（相信大家都明白）"
5. 打破公文格式束缚，用讲故事的方式表达
6. 使用具体的人称，如"我这个局长"、"咱们局里"、"各位同事"
7. 情感真实，有喜怒哀乐，不是冰冷的官话
8. 使用方言词汇或地方特色表达（如适用）
9. 偶尔使用反问、感叹、甚至轻微的自嘲
10. 记住：你是在代表一个人说话，不是在执行程序`,
  };

  return '\n\n' + prompts[level];
}

/**
 * 获取系统角色的附加描述（增强去AI味效果）
 */
export function getHumanizeSystemRole(level: HumanizeLevel): string {
  if (level === 'none') {
    return '你是一位资深的政府公文写作专家，擅长撰写各类教育政务公文。';
  }

  const roles: Record<Exclude<HumanizeLevel, 'none'>, string> = {
    light: '你是一位资深的政府公文写作专家，有15年笔杆子经验。你的文字功底扎实，但懂得在正式与亲切之间把握分寸。',
    
    medium: '你是一位资深的政府公文写作专家，写了20多年材料。你深知官样文章让人厌倦，所以你的文字有温度、有态度，不刻板、不套路。',
    
    deep: '你是一位干了30多年的老笔杆子，从科员写到处长，经手的材料摞起来有几人高。你什么人没见过、什么话没写过？现在你写东西，早就跳出了那些框框——怎么顺口怎么来，怎么管用怎么写。你的文字有烟火气、有人情味，让人读着像是一个真人在说话，而不是一台机器在输出。',
  };

  return roles[level];
}

/**
 * 后处理增强（可选，用于进一步优化文本）
 * 注意：此函数为轻量级规则处理，不涉及LLM调用
 */
export function postProcessHumanize(text: string, level: HumanizeLevel): string {
  if (level === 'none') return text;

  let result = text;

  // 通用替换：去除过于规整的编号
  if (level === 'medium' || level === 'deep') {
    // 将"第一、第二、第三"替换为更自然的表达
    result = result.replace(/第[一二三四五六七八九十]、/g, (match) => {
      const map: Record<string, string> = {
        '第一、': '首先，',
        '第二、': '其次，', 
        '第三、': '再者，',
        '第四、': '还有，',
        '第五、': '另外，',
      };
      return map[match] || match;
    });
  }

  // 深度级别：进一步打破规整性
  if (level === 'deep') {
    // 随机替换一些连接词
    const replacements: Array<[RegExp, string[]]> = [
      [/综上所述/g, ['说到底', '说白了', '总的来讲']],
      [/因此/g, ['所以啊', '这样一来']],
      [/然而/g, ['不过呢', '但是话说回来']],
      [/此外/g, ['还有就是', '另外一点']],
    ];

    for (const [pattern, alternatives] of replacements) {
      if (Math.random() > 0.5) {
        const replacement = alternatives[Math.floor(Math.random() * alternatives.length)];
        result = result.replace(pattern, replacement);
      }
    }
  }

  return result;
}

/**
 * 获取去AI味参数验证
 */
export function validateHumanizeLevel(level: unknown): HumanizeLevel {
  if (level === 'light' || level === 'medium' || level === 'deep') {
    return level as HumanizeLevel;
  }
  return 'none';
}

/**
 * Humanize参数接口定义
 */
export interface HumanizeOptions {
  /** 去AI味强度级别 */
  level: HumanizeLevel;
  /** 是否启用后处理增强 */
  enablePostProcess?: boolean;
  /** 保留的AI特征（可选白名单） */
  preservePatterns?: string[];
}

export default {
  getHumanizePrompt,
  getHumanizeSystemRole,
  postProcessHumanize,
  validateHumanizeLevel,
};
