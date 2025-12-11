import { randomUUID } from 'crypto';

// 定义我们期望 AI 返回的数据结构
export interface ProcessedQuestion {
  text: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
  options: { id: string; text: string; label: string }[];
  correctAnswerLabels: string[];
  explanation?: string;
}

function splitTextIntoChunks(text: string, chunkSize: number = 2000, overlap: number = 200): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let currentChunkLines: string[] = [];
  let currentLength = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] + '\n';
    currentChunkLines.push(line);
    currentLength += line.length;

    // 当当前块足够大时
    if (currentLength >= chunkSize) {
      chunks.push(currentChunkLines.join(''));

      // 保留当前块的最后几行作为下一块的开头
      const linesToKeep = 5;
      if (currentChunkLines.length > linesToKeep) {
        currentChunkLines = currentChunkLines.slice(-linesToKeep);
        currentLength = currentChunkLines.join('').length;
      } else {
        // 如果块本身就很短，就全清空
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

  console.log(`⏳ [${chunkIndex + 1}/${totalChunks}] 正在分析第 ${chunkIndex + 1} 部分...`);

  const prompt = `
    你是一个专业的试题数据清洗专家。你的任务是从文本中提取题目。
    ### 核心指令：
    1. 提取文本当中出现的**所有**选择题。
    2. **忽略标题和前言**：文档开头可能有标题或说明，请直接跳过它们，寻找后面的题目。
    3. **不要遗漏**：尽可能多地提取！即使题目看起来格式不完美也要提取。
    4. 严格输出 JSON 数组。

    ### JSON 输出结构：
    [
      {
        "text": "题目内容",
        "type": "SINGLE_CHOICE" | "MULTIPLE_CHOICE",
        "options": [{ "label": "A", "text": "选项内容" }],
        "correctAnswerLabels": ["A"],
        "explanation": "解析"
      }
    ]

    ### 待处理文本：
    ${chunkText}
  `;

  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [{ role: 'user', content: prompt }],
        format: 'json',
        stream: false,
        options: { num_ctx: 4096, temperature: 0.1 }
      }),
    });

    if (!response.ok) throw new Error(`Ollama Error: ${response.statusText}`);

    const json = await response.json();
    let content = json.message.content.replace(/```json/g, '').replace(/```/g, '').trim();

    let data;
    try {
      data = JSON.parse(content);
    } catch (e) {
      console.warn(`⚠️ 第 ${chunkIndex + 1} 部分 JSON 解析失败，跳过`);
      return [];
    }

    if (!Array.isArray(data)) {
      if (data.questions && Array.isArray(data.questions)) data = data.questions;
      else if (data.items && Array.isArray(data.items)) data = data.items;
      else data = [data];
    }
    return data;

  } catch (error) {
    console.error(`❌ 第 ${chunkIndex + 1} 部分处理出错:`, error);
    return [];
  }
}

export async function processWithAI(rawText: string): Promise<ProcessedQuestion[]> {
  console.log("✂️ 正在将文本切分为片段进行批量处理...");

  const chunks = splitTextIntoChunks(rawText, 3000);
  console.log(`📦 共切分为 ${chunks.length} 个片段`);

  let allQuestions: ProcessedQuestion[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkQuestions = await processChunk(chunks[i], i, chunks.length);

    const mappedQuestions = chunkQuestions.map((item: any): ProcessedQuestion => {
      let cleanText = String(item.text || "未知题目");

      // 执行正则替换
      cleanText = cleanText.replace(/[\(（]\s*[A-Z0-9\s,，、]+\s*[\)）]/gi, '（ ）');

      return {
        text: cleanText,
        type: (item.type === 'MULTIPLE_CHOICE' ? 'MULTIPLE_CHOICE' : 'SINGLE_CHOICE') as 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE',
        options: Array.isArray(item.options) ? item.options.map((opt: any) => ({
          id: randomUUID(),
          text: String(opt.text || ""), // 选项内容也防一手
          label: opt.label ? String(opt.label).replace(/[\.、]/g, '').trim().toUpperCase() : ''
        })) : [],
        correctAnswerLabels: Array.isArray(item.correctAnswerLabels)
          ? item.correctAnswerLabels.map((s: any) => String(s).trim().toUpperCase())
          : (typeof item.correctAnswerLabels === 'string' || typeof item.correctAnswerLabels === 'number'
            ? String(item.correctAnswerLabels).split('').map(s => s.trim().toUpperCase())
            : []),
        explanation: item.explanation || "AI 自动解析"
      };
    });

    const validQuestions = mappedQuestions.filter(q => q.text && q.options.length > 0);
    allQuestions = allQuestions.concat(validQuestions);

    console.log(`✅ 第 ${i + 1} 部分提取到 ${validQuestions.length} 道题目`);
  }

  console.log(`🎉 全部处理完成！共提取 ${allQuestions.length} 道题目`);
  return allQuestions;
}