import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { ProcessedQuestion } from './aiProcessor';
import { randomUUID } from 'crypto';

dotenv.config();

const logger = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  warn: (msg: string) => console.warn(`⚠️  ${msg}`),
  error: (msg: string, err?: any) => {
    console.error(`❌ ${msg}`);
    if (err) console.error(`   ${err.message || err}`);
  },
  debug: (msg: string, data?: any) => {
    if (process.env.DEBUG === 'true') {
      console.log(`🔍 [DEBUG] ${msg}`);
      if (data) console.log(`   ${JSON.stringify(data, null, 2)}`);
    }
  }
};

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

export async function uploadQuestions(questions: ProcessedQuestion[], categoryName: string) {
  if (questions.length === 0) {
    logger.warn("没有题目需要上传");
    return;
  }

  logger.info(`准备上传 ${questions.length} 道题目到类别: "${categoryName}"`);
  logger.debug(`Supabase URL: ${process.env.SUPABASE_URL}`);

  const dbRows = questions.map((q, index) => {
    const correctOptionIds = q.options
      .filter(opt => q.correctAnswerLabels.includes(opt.label))
      .map(opt => opt.id);

    if (correctOptionIds.length === 0) {
      logger.warn(`第 ${index + 1} 题: 找不到对应的正确答案选项ID (答案: ${q.correctAnswerLabels.join(',')})`);
    }

    const cleanOptions = q.options.map(opt => ({ id: opt.id, text: opt.text }));

    const row = {
      id: randomUUID(),
      category: categoryName,
      type: q.type,
      text: q.text,
      options: cleanOptions,
      correct_option_ids: correctOptionIds,
      explanation: q.explanation,
      created_at: new Date().toISOString()
    };

    logger.debug(`第 ${index + 1} 题数据:`, {
      id: row.id,
      type: row.type,
      textPreview: row.text.substring(0, 40),
      optionCount: cleanOptions.length,
      correctAnswers: row.correct_option_ids.length
    });

    return row;
  });

  try {
    logger.info(`开始批量插入 ${dbRows.length} 条记录到表 'questions'...`);

    // 批量插入
    const { data, error } = await supabase
      .from('questions')
      .insert(dbRows)
      .select();

    if (error) {
      logger.error(`Supabase 插入失败: ${error.message}`, error);

      // 尝试逐条插入以获取更详细的错误信息
      logger.warn(`尝试逐条插入以定位错误...`);
      for (let i = 0; i < dbRows.length; i++) {
        const { error: singleError } = await supabase
          .from('questions')
          .insert([dbRows[i]])
          .select();

        if (singleError) {
          logger.error(`第 ${i + 1} 条记录插入失败: ${singleError.message}`);
          logger.debug(`失败记录内容:`, dbRows[i]);
          throw singleError;
        }
      }
    } else {
      const count = data?.length || 0;
      logger.success(`✨ 成功导入 ${count} 道题目！`);

      if (count > 0) {
        logger.info(`数据库记录ID: ${data?.[0]?.id || 'N/A'} (共 ${count} 条)`);
      }
    }
  } catch (error) {
    logger.error(`上传过程出错`, error);
    throw error;
  }
}