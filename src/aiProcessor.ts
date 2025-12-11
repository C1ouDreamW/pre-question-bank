import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// 定义我们期望 AI 返回的数据结构
export interface ProcessedQuestion {
  text: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
  options: { id: string; text: string; label: string }[];
  correctAnswerLabels: string[];
  explanation?: string;
}

export async function processWithAI(rawText: string): Promise<ProcessedQuestion[]> {
  console.log("🤖 正在请求 Gemini AI 进行分析 (可能需要几十秒)...");

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json" // 强制返回 JSON
    }
  });

  const prompt = `
    你是一个专业的试题数据清洗专家。你的任务是将从 Word 文档提取的非结构化文本，转换为符合数据库规范的结构化 JSON 数据。

    ### 核心任务：
    请分析传入的文本，提取所有题目，并严格按照下方的 [JSON 输出结构] 输出一个 JSON 数组。

    ### 处理规则（非常重要）：
    1.  **题目清洗（Text Cleaning）**：
        * 如果题目中包含答案（例如括号内有字母 "Python是( A )语言" 或 "1. (C) 下列..."），**请务必将答案字母移除，保留空括号或空格**。
        * 例如："1. (A) 这是题目" -> "1. ( ) 这是题目"； "我们要坚持(AB)原则" -> "我们要坚持( )原则"。
        * 去除题目开头的非必要编号（如自动编号难以去除可保留，但尽量清洗）。

    2.  **选项提取（Options）**：
        * 识别 A. B. C. D. 等选项。
        * **必须保留选项标号**（Label），这将用于后续程序映射数据库 ID。
        * 选项内容（Text）中去掉开头的 "A." 或 "A、" 等标号。

    3.  **答案匹配（Answer Matching）**：
        * **全文档搜索**：正确答案可能在题目括号里、题目紧随其后、或者文档的最末尾（常见的答案表）。
        * **多源验证**：如果题目里有答案，文档末尾也有答案表，以题目里的为准（或者你认为更可信的那个）。
        * **输出格式**：correctAnswerLabels 必须是数组，例如单选 ["A"]，多选 ["A", "B", "D"]。

    4.  **题型判断（Type Detection）**：
        * 如果正确答案包含多个选项（如 AB），或者题干包含“多选”、“复选”字样，type 设为 "MULTIPLE_CHOICE"。
        * 否则默认为 "SINGLE_CHOICE"。

    5.  **解析生成（Explanation）**：
        * 如果文中包含“解析：”、“详解：”等内容，请提取。
        * 如果未找到解析，请根据题目知识点和正确答案，**自动生成**一句简短、专业的解析。

    ### JSON 输出结构（Strict Schema）：
    请直接输出 JSON 数组，**不要包含** \`\`\`json markdown 标记，只输出纯文本 JSON。

    [
      {
        "text": "题目内容（已清洗，去除了括号内的答案）",
        "type": "SINGLE_CHOICE" | "MULTIPLE_CHOICE",
        "options": [
          { "label": "A", "text": "选项A的内容" },
          { "label": "B", "text": "选项B的内容" }
        ],
        "correctAnswerLabels": ["A", "C"],
        "explanation": "这是解析内容"
      }
    ]

    ### 待处理文本：
    ${rawText}
  `;

  try {
    const result = await model.generateContent(prompt);
    let response = result.response.text();
    response = response.replace(/```json/g, '').replace(/```/g, '').trim();
    // 尝试解析 JSON，如果失败 catch 会捕获
    const data = JSON.parse(response) as any[];

    // 简单清洗数据，确保符合接口定义
    return data.map((item: any) => ({
      text: item.text,
      type: item.type === 'MULTIPLE_CHOICE' ? 'MULTIPLE_CHOICE' : 'SINGLE_CHOICE',
      options: item.options.map((opt: any) => ({
        id: randomUUID(),
        text: opt.text,
        label: opt.label ? opt.label.replace('.', '').trim().toUpperCase() : ''
      })),
      correctAnswerLabels: Array.isArray(item.correctAnswerLabels)
        ? item.correctAnswerLabels.map((s: string) => s.trim().toUpperCase())
        : (typeof item.correctAnswerLabels === 'string'
          ? (item.correctAnswerLabels as string).split('').map(s => s.trim().toUpperCase())
          : []),
      explanation: item.explanation || "AI 自动解析"
    }));

  } catch (error) {
    console.error("AI 处理或 JSON 解析失败:", error);
    // 需要调试
    console.log("Raw Response:", error);
    return [];
  }
}