import { extractTextFromDocx } from './textParser';
import { processWithAI } from './aiProcessor';
import { uploadQuestions } from './uploader';
import path from 'path';

async function main() {
  if (!process.env.GEMINI_API_KEY || !process.env.SUPABASE_URL) {
    console.error("❌ 错误: 环境变量未配置。请确保 .env 文件存在且包含 GEMINI_API_KEY 和 SUPABASE 配置。");
    process.exit(1);
  }
  // 获取命令行参数
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("用法: npm start <docx文件路径> <类别名称>");
    console.log("示例: npm start ./docs/maogai.docx '毛概'");
    return;
  }

  const [filePath, categoryName] = args;
  const fullPath = path.resolve(filePath);

  try {
    // 读取
    const rawText = await extractTextFromDocx(fullPath);
    if (!rawText) {
      console.error("文本提取为空，请检查文件内容");
      return;
    }

    // AI处理
    const questions = await processWithAI(rawText);

    if (questions.length === 0) {
      console.log("⚠️ AI 未识别到任何题目，请检查文档格式或 AI 响应");
      return;
    }

    console.log(`👀 预览第一题: ${questions[0].text.substring(0, 30)}... (答案: ${questions[0].correctAnswerLabels.join(',')})`);

    // 上传
    await uploadQuestions(questions, categoryName);

  } catch (error) {
    console.error("执行出错:", error);
  }
}

main();