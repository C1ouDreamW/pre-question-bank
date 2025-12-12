import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';

const logger = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  warn: (msg: string) => console.warn(`⚠️  ${msg}`),
  error: (msg: string, err?: any) => {
    console.error(`❌ ${msg}`);
    if (err) console.error(`   ${err.message || err}`);
  }
};

export async function extractTextFromDocx(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    logger.error(`文件不存在: ${filePath}`);
    throw new Error(`文件未找到: ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  logger.info(`检测到文件类型: ${ext} (${fileName})`);

  try {
    if (ext === '.txt') {
      // 对于 txt 文件，直接以 utf-8 编码读取
      logger.info(`使用 UTF-8 编码读取 TXT 文件...`);
      const content = fs.readFileSync(filePath, 'utf-8');
      logger.success(`TXT 文件读取成功，大小: ${content.length} 字符`);
      return content;
    }
    else if (ext === '.docx') {
      // 对于 docx 文件，使用 mammoth 解析
      logger.info(`使用 Mammoth 解析 DOCX 文件...`);
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });

      if (result.messages && result.messages.length > 0) {
        logger.warn(`Mammoth 解析提示:`);
        result.messages.forEach(msg => logger.warn(`  - ${msg}`));
      }

      logger.success(`DOCX 文件读取成功，大小: ${result.value.length} 字符`);
      return result.value;
    }
    else {
      logger.error(`不支持的文件格式: ${ext}`);
      throw new Error(`不支持的文件格式: ${ext}。目前仅支持 .docx 和 .txt`);
    }
  } catch (error: any) {
    logger.error(`读取文件失败: ${filePath}`, error);

    if (ext === '.txt') {
      logger.warn(`💡 如果是 TXT 文件，请确保文件编码为 UTF-8 (不要用 ANSI/GBK)`);
    }

    throw error;
  }
}