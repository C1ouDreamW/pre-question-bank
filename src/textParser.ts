import mammoth from 'mammoth';
import fs from 'fs';

export async function extractTextFromDocx(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件未找到: ${filePath}`);
  }

  console.log(`📄 正在读取文件: ${filePath}...`);
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value; // 返回纯文本
}