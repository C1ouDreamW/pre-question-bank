import { randomUUID } from 'crypto';

export interface ProcessedQuestion {
  text: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
  options: { id: string; text: string; label: string }[];
  correctAnswerLabels: string[];
  explanation?: string;
}

// 日志辅助函数
const logger = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  warn: (msg: string) => console.warn(`⚠️  ${msg}`),
  error: (msg: string, err?: any) => {
    console.error(`❌ ${msg}`);
    if (err) console.error(`   错误详情: ${err.message || err}`);
  },
  debug: (msg: string, data?: any) => {
    if (process.env.DEBUG === 'true') {
      console.log(`🔍 [DEBUG] ${msg}`);
      if (data) console.log(`   数据: ${JSON.stringify(data, null, 2)}`);
    }
  }
};

// 文本切分函数 (保持重叠逻辑)
function splitTextIntoChunks(text: string, chunkSize: number = 3000, overlap: number = 200): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let currentChunkLines: string[] = [];
  let currentLength = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] + '\n';
    currentChunkLines.push(line);
    currentLength += line.length;

    if (currentLength >= chunkSize) {
      chunks.push(currentChunkLines.join(''));

      const linesToKeep = 5;
      if (currentChunkLines.length > linesToKeep) {
        currentChunkLines = currentChunkLines.slice(-linesToKeep);
        currentLength = currentChunkLines.join('').length;
      } else {
        currentChunkLines = [];
        currentLength = 0;
      }
    }
  }

  if (currentChunkLines.length > 0) {
    chunks.push(currentChunkLines.join(''));
  }

  return chunks;
}

async function processChunk(chunkText: string, chunkIndex: number, totalChunks: number): Promise<any[]> {
  const OLLAMA_URL = 'http://localhost:11434/api/chat';
  const MODEL_NAME = 'qwen2.5';

  logger.info(`[${chunkIndex + 1}/${totalChunks}] 正在分析第 ${chunkIndex + 1} 部分 (${chunkText.length} 字符)...`);

  const systemPrompt = `
    你是一个专业的试题数据清洗专家。你的任务是将非结构化文本转换为 JSON。
    
    ### 核心指令：
    1.  **提取所有题目**：请分析用户输入的文本，提取文本当中出现的**每一道**选择题。
    2.  **忽略干扰信息**：如果开头有 "题库"、"导论"、"单项选择题"、"多项选择题" 等大标题，请直接忽略，从第一道具体的题目开始提取。
    3.  **JSON 格式**：必须输出一个包含所有题目的 JSON 数组。
    4.  **题目清洗**：删除题目中括号内的答案标号（如"（ A ）"改为"（ ）"）。
    5.  **答案映射**：correctAnswerLabels 必须是数组格式，单选如["A"]，多选如["A","B"]。
    
    ### JSON 结构示例：
    [
      {
        "text": "题目内容",
        "type": "SINGLE_CHOICE" | "MULTIPLE_CHOICE",
        "options": [{ "label": "A", "text": "内容" }],
        "correctAnswerLabels": ["A"],
        "explanation": "解析"
      }
    ]
  `;

  try {
    logger.debug(`发送请求到 Ollama: ${OLLAMA_URL}`);

    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: systemPrompt }, // 指令
          { role: 'user', content: `待处理文本：\n${chunkText}` } // 数据
        ],
        format: 'json',
        stream: false,
        options: {
          num_ctx: 8192,  // 显存窗口扩大到 8192 (约6000汉字)，防止长文本处理时截断，根据自己电脑的显存容量决定
          temperature: 0.2
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();

    if (!json.message || !json.message.content) {
      logger.warn(`第 ${chunkIndex + 1} 部分：AI响应格式异常，跳过`);
      logger.debug(`AI响应内容`, json);
      return [];
    }

    let content = json.message.content.replace(/```json/g, '').replace(/```/g, '').trim();

    logger.debug(`第 ${chunkIndex + 1} 部分 AI 原始响应`, { contentLength: content.length, preview: content.substring(0, 200) });

    let data;
    try {
      data = JSON.parse(content);
    } catch (e: any) {
      logger.warn(`第 ${chunkIndex + 1} 部分 JSON 解析失败`);
      logger.debug(`解析失败的原始内容`, { content: content.substring(0, 300) });
      return [];
    }

    // 智能结构修复
    if (!Array.isArray(data)) {
      logger.debug(`第 ${chunkIndex + 1} 部分：数据不是数组，尝试结构修复`, { dataType: typeof data, dataKeys: Object.keys(data || {}) });
      if (data.questions && Array.isArray(data.questions)) {
        data = data.questions;
        logger.info(`第 ${chunkIndex + 1} 部分：从 .questions 字段提取数组`);
      } else if (data.items && Array.isArray(data.items)) {
        data = data.items;
        logger.info(`第 ${chunkIndex + 1} 部分：从 .items 字段提取数组`);
      } else if (data.data && Array.isArray(data.data)) {
        data = data.data;
        logger.info(`第 ${chunkIndex + 1} 部分：从 .data 字段提取数组`);
      } else if (data.text && Array.isArray(data.text)) {
        data = data.text;
        logger.info(`第 ${chunkIndex + 1} 部分：从 .text 字段提取数组`);
      } else {
        // 检查是否同时有单选和多选，或者某种未知格式
        const hasSingleChoice = data.single_choice && Array.isArray(data.single_choice);
        const hasMultipleChoice = data.multiple_choice && Array.isArray(data.multiple_choice);
        const singleCount = hasSingleChoice ? data.single_choice.length : 0;
        const multipleCount = hasMultipleChoice ? data.multiple_choice.length : 0;

        if (hasSingleChoice && hasMultipleChoice) {
          const combined = [...data.single_choice, ...data.multiple_choice];
          data = combined;
          logger.info(`第 ${chunkIndex + 1} 部分：合并单选 ${singleCount} 题和多选 ${multipleCount} 题，共 ${combined.length} 题`);
        } else if (hasSingleChoice) {
          data = data.single_choice;
          logger.info(`第 ${chunkIndex + 1} 部分：从 .single_choice 字段提取数组 (${singleCount} 题)`);
        } else if (hasMultipleChoice) {
          data = data.multiple_choice;
          logger.info(`第 ${chunkIndex + 1} 部分：从 .multiple_choice 字段提取数组 (${multipleCount} 题)`);
        } else {
          data = [data];
          logger.info(`第 ${chunkIndex + 1} 部分：单个对象已包装成数组`);
        }
      }
    }

    logger.success(`第 ${chunkIndex + 1} 部分 AI 处理成功，返回 ${Array.isArray(data) ? data.length : 0} 条记录`);
    return Array.isArray(data) ? data : [];

  } catch (error) {
    logger.error(`第 ${chunkIndex + 1} 部分 AI 处理失败`, error);
    return [];
  }
}

// 数据验证函数
function validateQuestion(q: ProcessedQuestion, index: number): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!q.text || q.text.trim().length === 0) {
    issues.push(`题目内容为空`);
  }

  if (!q.options || q.options.length < 2) {
    issues.push(`选项数少于2个 (当前: ${q.options?.length || 0})`);
  }

  if (!q.correctAnswerLabels || q.correctAnswerLabels.length === 0) {
    issues.push(`答案标签为空`);
  }

  if (q.correctAnswerLabels) {
    const validLabels = q.options.map(opt => opt.label);
    const invalidLabels = q.correctAnswerLabels.filter(label => !validLabels.includes(label));
    if (invalidLabels.length > 0) {
      issues.push(`答案标签不匹配 (无效: ${invalidLabels.join(',')})`);
    }
  }

  if (q.type !== 'SINGLE_CHOICE' && q.type !== 'MULTIPLE_CHOICE') {
    issues.push(`题型不合法: ${q.type}`);
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

export async function processWithAI(rawText: string): Promise<ProcessedQuestion[]> {
  logger.info(`文本大小: ${rawText.length} 字符，准备切分处理...`);

  const chunks = splitTextIntoChunks(rawText, 3000);  // 切分长度3000
  logger.info(`已切分为 ${chunks.length} 个片段，每个约 3000 字符`);

  let allQuestions: ProcessedQuestion[] = [];
  let totalProcessed = 0;
  let totalValidated = 0;
  let totalDiscarded = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunkQuestions = await processChunk(chunks[i], i, chunks.length);
    totalProcessed += chunkQuestions.length;

    const mappedQuestions = chunkQuestions.map((item: any, itemIndex: number): ProcessedQuestion | null => {
      try {
        // 强制转 String 并清洗题目中的答案
        let cleanText = String(item.text || "未知题目");
        cleanText = cleanText.replace(/[\(（]\s*[A-Z0-9\s,，、]+\s*[\)）]/gi, '（ ）');

        const question: ProcessedQuestion = {
          text: cleanText,
          // 类型断言修复
          type: (item.type === 'MULTIPLE_CHOICE' ? 'MULTIPLE_CHOICE' : 'SINGLE_CHOICE') as 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE',
          options: Array.isArray(item.options) ? item.options.map((opt: any) => ({
            id: randomUUID(),
            text: String(opt.text || ""),
            label: opt.label ? String(opt.label).replace(/[\.、]/g, '').trim().toUpperCase() : ''
          })) : [],
          correctAnswerLabels: Array.isArray(item.correctAnswerLabels)
            ? item.correctAnswerLabels.map((s: any) => String(s).trim().toUpperCase())
            : (typeof item.correctAnswerLabels === 'string' || typeof item.correctAnswerLabels === 'number'
              ? String(item.correctAnswerLabels).split('').map(s => s.trim().toUpperCase()).filter(s => s.length > 0)
              : []),
          explanation: item.explanation || "AI 自动解析"
        };

        return question;
      } catch (err) {
        logger.warn(`第 ${i + 1} 部分第 ${itemIndex + 1} 题映射失败: ${err instanceof Error ? err.message : '未知错误'}`);
        return null;
      }
    }).filter((q): q is ProcessedQuestion => q !== null);

    // 数据验证
    const validQuestions: ProcessedQuestion[] = [];
    const invalidQuestions: Array<{ question: ProcessedQuestion; issues: string[] }> = [];

    for (const q of mappedQuestions) {
      const validation = validateQuestion(q, allQuestions.length + validQuestions.length);
      if (validation.valid) {
        validQuestions.push(q);
        totalValidated++;
      } else {
        invalidQuestions.push({ question: q, issues: validation.issues });
        totalDiscarded++;
      }
    }

    // 记录验证结果
    if (invalidQuestions.length > 0) {
      logger.warn(`第 ${i + 1} 部分有 ${invalidQuestions.length} 道题目数据不合法:`);
      invalidQuestions.slice(0, 3).forEach(({ question: q, issues }) => {
        logger.debug(`  - 题目: "${q.text.substring(0, 30)}..." | 问题: ${issues.join('; ')}`);
      });
      if (invalidQuestions.length > 3) {
        logger.warn(`  ... 还有 ${invalidQuestions.length - 3} 道题目未显示`);
      }
    }

    allQuestions = allQuestions.concat(validQuestions);
    logger.success(`第 ${i + 1} 部分：AI 返回 ${mappedQuestions.length} 题，其中有效 ${validQuestions.length} 题`);
  }

  logger.info(`\n========== 处理统计 ==========`);
  logger.info(`总处理: ${totalProcessed} 题`);
  logger.success(`有效题目: ${totalValidated} 题`);
  logger.warn(`丢弃: ${totalDiscarded} 题`);
  logger.info(`=============================\n`);

  return allQuestions;
}