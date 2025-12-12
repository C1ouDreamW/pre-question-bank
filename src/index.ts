import { extractTextFromDocx } from './textParser';
import { processWithAI } from './aiProcessor';
import { uploadQuestions } from './uploader';
import path from 'path';

// 日志工具
const logger = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  warn: (msg: string) => console.warn(`⚠️  ${msg}`),
  error: (msg: string, err?: any) => {
    console.error(`❌ ${msg}`);
    if (err) {
      console.error(`   ${err.message || err}`);
      if (process.env.DEBUG === 'true' && err.stack) {
        console.error(`   堆栈: ${err.stack}`);
      }
    }
  }
};

//主函数
async function main() {
  const startTime = Date.now();
  logger.info(`========== 开始数据处理流程 ==========`);

  if (!process.env.SUPABASE_URL) {
    logger.error("环境变量 SUPABASE_URL 未配置。请确保 .env 文件存在且配置正确");
    process.exit(1);
  }

  if (!process.env.SUPABASE_SERVICE_KEY) {
    logger.error("环境变量 SUPABASE_SERVICE_KEY 未配置。请确保 .env 文件存在且配置正确");
    process.exit(1);
  }

  // 获取命令行参数
  const args = process.argv.slice(2);
  if (args.length < 2) {
    logger.warn("用法: npm start <文件路径> <类别名称>");
    logger.warn("示例: npm start ./docs/maogai.docx '毛概'");
    logger.warn("      npm start ./Ti/t1.txt '毛概'");
    process.exit(1);
  }

  const [filePath, categoryName] = args;
  const fullPath = path.resolve(filePath);

  logger.info(`文件路径: ${fullPath}`);
  logger.info(`题目类别: ${categoryName}`);

  try {
    // 读取文档
    logger.info(`→ 正在读取文档...`);
    const rawText = await extractTextFromDocx(fullPath);

    if (!rawText || rawText.trim().length === 0) {
      logger.error("文本提取为空，请检查文件内容是否正常");
      process.exit(1);
    }

    logger.success(`文档读取完成，文本大小: ${rawText.length} 字符`);

    // AI处理
    logger.info(`→ 正在进行 AI 数据清洗处理...`);
    const questions = await processWithAI(rawText);

    if (questions.length === 0) {
      logger.warn("AI 未识别到任何有效题目，请检查:");
      logger.warn("  1. 文档格式是否符合要求（选择题格式）");
      logger.warn("  2. Ollama 服务是否正常运行");
      logger.warn("  3. qwen2.5 模型是否已加载");
      process.exit(1);
    }

    // 预览第一题
    logger.success(`成功提取 ${questions.length} 道有效题目`);
    logger.info(`\n👀 预览第一题:`);
    logger.info(`   题目: ${questions[0].text.substring(0, 50)}${questions[0].text.length > 50 ? '...' : ''}`);
    logger.info(`   类型: ${questions[0].type}`);
    logger.info(`   答案: ${questions[0].correctAnswerLabels.join(',')}`);

    // 上传到 Supabase
    logger.info(`→ 正在上传题目到 Supabase...`);
    await uploadQuestions(questions, categoryName);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.success(`\n========== 处理完成 ==========`);
    logger.success(`上传题目数: ${questions.length}`);
    logger.success(`类别: ${categoryName}`);
    logger.success(`总耗时: ${duration}秒`);

  } catch (error) {
    logger.error(`处理过程中出错`, error);
    process.exit(1);
  }
}

main();