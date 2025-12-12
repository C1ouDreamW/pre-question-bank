# 📋 快速参考卡

## 5 分钟快速开始

### 1️⃣ 安装与配置
```bash
# 安装依赖
npm install

# 配置数据库
cp .env.example .env
# 编辑 .env，填入 Supabase 凭证
```

### 2️⃣ 启动服务
```bash
# 终端 1: 启动 Ollama
ollama serve

# 终端 2: 下载模型（首次）
ollama pull qwen2.5

# 终端 3: 运行程序
npm start ./Ti/t1.txt "毛概"
```

### 3️⃣ 查看结果
检查 Supabase Dashboard 的 `questions` 表

---

## 常用命令

```bash
# 处理 TXT 文件
npm start ./Ti/t1.txt "毛概"

# 处理 DOCX 文件
npm start ./docs/exam.docx "中国近代史"

# 启用调试模式（查看 AI 原始响应）
set DEBUG=true && npm start ./Ti/t1.txt "毛概"

# 查看已安装的 Ollama 模型
ollama list

# 下载其他模型
ollama pull llama2
ollama pull neural-chat
```

---

## 环境变量配置 (.env)

```env
# Supabase 配置 (必需)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# 调试模式 (可选，默认 false)
DEBUG=false
```

**获取 Supabase 凭证：**
1. https://app.supabase.com
2. 选择项目 → Settings → API
3. 复制 `Project URL` 和 `Service Role Key`

---

## 文件格式要求

### TXT 文件（推荐）
```
✅ 编码：UTF-8
✅ 题号：1. 2. 3. ...
✅ 选项：A. B. C. D. ...
✅ 答案：在文末，格式为 "答案：1.A 2.B 3.C ..." 或者 在题目末尾（）中

一、单项选择题
1. 题目文本？
   A. 选项A
   B. 选项B
   C. 选项C
   D. 选项D

答案：1.A

二、多项选择题
1. 题目文本？
   A. 选项A
   B. 选项B
   C. 选项C
   D. 选项D

答案：1.AB
```

### DOCX 文件
需要与 TXT 相同的内容格式

---

## 故障排除速查表

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `ECONNREFUSED` | Ollama 未启动 | `ollama serve` |
| `Model not found` | 模型未下载 | `ollama pull qwen2.5` |
| `.env` 未配置 | 缺少配置文件 | `cp .env.example .env` |
| JSON 解析失败 | AI 输出异常 | 启用 `DEBUG=true` 查看 |
| 插入数据库失败 | 凭证错误或权限不足 | 检查 SERVICE_KEY |

---

## 日志图标速查

| 图标 | 含义 | 示例 |
|------|------|------|
| `ℹ️` | 信息 | 文件路径、处理进度 |
| `✅` | 成功 | 文档读取成功、上传成功 |
| `⚠️` | 警告 | 题目丢弃、数据不完整 |
| `❌` | 错误 | 处理失败、连接错误 |
| `🔍` | 调试 | AI 原始响应（DEBUG=true） |

---

## 输出示例解读

```bash
$ npm start ./Ti/t1.txt "毛概"

ℹ️  ========== 开始数据处理流程 ==========
   ↑ 开始标记

✅ 文档读取完成，文本大小: 5234 字符
   ↑ 文本成功提取

✅ 第 1 部分 AI 处理成功，返回 16 条记录
   ↑ AI 识别了 16 道题目

✅ 有效题目: 22 题
   ↑ 所有题目都通过了 5 层验证

✅ 成功导入 22 道题目！
   ↑ 所有题目都上传到了 Supabase

✅ 总耗时: 12.34 秒
   ↑ 整个流程耗时
```

---

## 性能预期

| 文件大小 | 题目数 | 耗时 | 备注 |
|---------|-------|------|------|
| <10KB | <20 | 3-5s | 小文件，快速处理 |
| 10-50KB | 20-100 | 8-15s | 中等文件 |
| 50-100KB | 100-200 | 20-40s | 大文件，推荐分批 |

*依赖硬件配置和网络状况*

---

## 数据库表结构速览

```sql
CREATE TABLE questions (
  id UUID,                           -- 唯一标识
  category TEXT,                     -- 题目类别（如"毛概"）
  type TEXT,                         -- SINGLE_CHOICE 或 MULTIPLE_CHOICE
  text TEXT,                         -- 题目内容
  options JSONB,                     -- [{ id, text }, ...]
  correct_option_ids TEXT[],         -- ['A'] 或 ['A', 'B']
  explanation TEXT,                  -- 题目解析
  created_at TIMESTAMP               -- 创建时间
);

-- 示例数据
INSERT INTO questions VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  '毛概',
  'SINGLE_CHOICE',
  '马克思主义中国化的含义是？',
  '[
    {"id": "A", "text": "将马克思主义应用到中国"},
    {"id": "B", "text": "改变马克思主义原理"},
    {"id": "C", "text": "中国化的马克思主义"},
    {"id": "D", "text": "以上都对"}
  ]',
  ['A'],
  null,
  NOW()
);
```

---

## API 调用示例（Supabase）

```typescript
// 查询所有题目
const { data, error } = await supabase
  .from('questions')
  .select('*');

// 按类别查询
const { data } = await supabase
  .from('questions')
  .select('*')
  .eq('category', '毛概');

// 按类型查询
const { data } = await supabase
  .from('questions')
  .select('*')
  .eq('type', 'SINGLE_CHOICE');

// 统计题目数
const { data } = await supabase
  .from('questions')
  .select('category, type, count(*)', { count: 'exact' })
  .groupBy('category, type');
```

---

## 项目文件说明

```
pre-question-bank/
├── src/
│   ├── index.ts                # 主入口 (99行)
│   ├── aiProcessor.ts          # AI 处理 (281行)
│   ├── textParser.ts           # 文本提取 (~70行)
│   └── uploader.ts             # 数据库上传 (~120行)
├── Ti/
│   └── t1.txt                  # 示例输入文件
├── .env.example                # 配置模板
├── .env                        # 实际配置 (.gitignore)
├── package.json                # 依赖配置
├── tsconfig.json               # TS 编译配置
├── README.md                   # 本文档
├── ARCHITECTURE.md             # 架构设计文档
├── MULTIPLE_CHOICE_ISSUE.md    # 多选题问题说明
└── ...
```

---

## 依赖版本信息

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.87.1",    // 数据库连接
    "mammoth": "^1.11.0",                  // DOCX 解析
    "dotenv": "^17.2.3"                    // 环境变量
  },
  "devDependencies": {
    "typescript": "^5.9.3",                // 类型检查
    "ts-node": "^10.9.2",                  // 运行 TS
    "@types/node": "^25.0.0"               // 节点类型
  }
}
```

---

## 技术栈

```
Node.js / TypeScript  ← 编程语言
    ↓
Ollama qwen2.5        ← AI 处理
    ↓
Supabase PostgreSQL   ← 数据存储
```

---

## 下一步

- 📖 查看详细文档：[README.md](./README.md)
- 🏗️ 了解架构设计：[ARCHITECTURE.md](./ARCHITECTURE.md)
- 🐛 查看问题说明：[MULTIPLE_CHOICE_ISSUE.md](./MULTIPLE_CHOICE_ISSUE.md)
- 💬 提交问题或反馈：[GitHub Issues](https://github.com/C1ouDreamW/pre-question-bank/issues)

---

**Made with ❤️ for ShuaShuaShua**
