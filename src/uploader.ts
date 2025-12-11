import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { ProcessedQuestion } from './aiProcessor';
import { randomUUID } from 'crypto';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

export async function uploadQuestions(questions: ProcessedQuestion[], categoryName: string) {
  console.log(`🚀 准备上传 ${questions.length} 道题目到类别: ${categoryName}`);

  const dbRows = questions.map(q => {
    const correctOptionIds = q.options
      .filter(opt => q.correctAnswerLabels.includes(opt.label))
      .map(opt => opt.id);

    const cleanOptions = q.options.map(opt => ({ id: opt.id, text: opt.text }));

    return {
      id: randomUUID(),
      category: categoryName,
      type: q.type,
      text: q.text,
      options: cleanOptions,
      correct_option_ids: correctOptionIds,
      explanation: q.explanation,
      created_at: new Date().toISOString()
    };
  });

  // 批量插入
  const { data, error } = await supabase
    .from('questions')
    .insert(dbRows)
    .select();

  if (error) {
    console.error('❌ 上传失败:', error.message);
  } else {
    console.log(`✅ 成功导入 ${data.length} 道题目！`);
  }
}