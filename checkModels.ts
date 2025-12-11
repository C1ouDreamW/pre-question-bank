import { GoogleGenerativeAI } from "@google/generative-ai";
import { setGlobalDispatcher, ProxyAgent } from 'undici';
import dotenv from 'dotenv';

dotenv.config();

// 需要代理，保持和之前一样的配置
const PROXY_URL = process.env.HTTPS_PROXY || 'http://127.0.0.1:7890';
try {
  const dispatcher = new ProxyAgent(PROXY_URL);
  setGlobalDispatcher(dispatcher);
} catch (e) {
  console.log("未配置代理或代理设置失败");
}

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  // 获取模型列表
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    console.log("📋 可用模型列表：");
    console.log("--------------------------------");
    (data.models || []).forEach((m: any) => {
      // 过滤出 gemini 系列
      if (m.name.includes('gemini')) {
        console.log(`名称: ${m.name.replace('models/', '')}`);
        console.log(`描述: ${m.displayName}`);
        console.log("--------------------------------");
      }
    });
  } catch (error) {
    console.error("查询失败:", error);
  }
}

listModels();