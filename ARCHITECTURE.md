# 🏗️ 架构与设计文档

## 系统架构

```
┌─────────────────────────────────────────────────────┐
│                    用户界面层                        │
│              (命令行参数: 文件路径+类别)             │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│                   主控流程                           │
│         (index.ts - 流程编排 & 错误处理)           │
└──┬──────────┬──────────┬─────────────┬──────────────┘
   │          │          │             │
   ▼          ▼          ▼             ▼
┌──────┐ ┌────────┐ ┌──────────┐ ┌─────────┐
│文本  │ │AI处理  │ │数据验证  │ │数据库  │
│提取  │ │(Ollama)│ │(5层检查) │ │上传    │
└──────┘ └────────┘ └──────────┘ └─────────┘
   │          │          │             │
   └──────────┴──────────┴─────────────┘
              │
         Supabase DB
```

---

## 核心模块详解

### 1. textParser.ts - 文本提取模块

**职责:** 从不同格式文件中提取原始文本内容

**设计:**
```typescript
// 支持的格式
interface TextExtractor {
  extract(filePath: string): Promise<string>;
}

// 格式检测
- .txt  → fs.readFileSync + UTF-8 解码
- .docx → mammoth.extractRawText()
```

**关键函数:**
```typescript
export async function extractTextFromDocx(
  filePath: string
): Promise<string>
```

**工作流:**
1. 检测文件扩展名
2. 根据类型选择相应解析器
3. 返回原始文本字符串
4. 记录文件大小和编码信息

**错误处理:**
- 文件不存在 → 提示正确路径
- 编码问题 → 自动转换为 UTF-8
- DOCX 损坏 → 详细错误信息

---

### 2. aiProcessor.ts - AI 处理核心

**职责:** 调用 Ollama qwen2.5，将原始文本转换为结构化数据

**关键设计:**

#### 文本切分策略
```typescript
const CHUNK_SIZE = 3000;        // 每块大小
const CHUNK_OVERLAP = 200;      // 重叠长度

目的: 避免题目被切断，保留上下文
优势: 大文件可分块处理，避免 token 溢出
```

#### System Prompt 设计
```
你是一个数据清洗专家。
输入：包含选择题的文本
输出：JSON 数组，每个对象代表一道题

要求：
1. 自动识别题号、题目、选项、答案
2. 输出格式化的 JSON
3. 忽略非题目内容
4. 清洗答案标号（如 (A) → A）

输出格式：
{
  "questions": [
    {
      "text": "题目文本",
      "type": "SINGLE_CHOICE|MULTIPLE_CHOICE",
      "options": [
        { "id": "A", "text": "选项文本" },
        ...
      ],
      "answer": "A|AB|ABC"
    }
  ]
}
```

#### 3 层响应验证
```
第1层: HTTP 状态检查
  ↓
第2层: 响应格式检查
  ↓
第3层: JSON 解析检查
  ↓
第4层: 数据结构映射检查
```

#### 7 种格式自动识别
```typescript
// AI 可能返回的各种格式
1. { questions: [...] }
2. { items: [...] }
3. { data: [...] }
4. { text: [...] }
5. { single_choice: [...] }
6. { multiple_choice: [...] }
7. { questions: [...], single_choice: [...], multiple_choice: [...] }

代码会自动检测并提取正确格式
```

#### Ollama API 调用
```typescript
POST http://localhost:11434/api/chat

Request:
{
  "model": "qwen2.5",
  "messages": [
    { "role": "system", "content": systemPrompt },
    { "role": "user", "content": textChunk }
  ],
  "stream": false,
  "options": {
    "temperature": 0.2,
    "top_k": 40,
    "top_p": 0.9,
    "num_ctx": 8192
  }
}

Response:
{
  "message": {
    "content": "{ ... JSON ... }"
  }
}
```

#### 数据映射流程
```
AI Response
    ↓
JSON Parse
    ↓
Format Detection (7种格式检查)
    ↓
Extract Array
    ↓
Map to ProcessedQuestion
    ↓
Validate Each Item
    ↓
Return Valid Array
```

---

### 3. uploader.ts - 数据库上传

**职责:** 将验证后的数据上传到 Supabase

**设计:**

#### 数据映射
```typescript
// 源数据结构
interface ProcessedQuestion {
  text: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
  options: Array<{ id: string; text: string }>;
  answer: string;
}

// 目标数据结构
interface DBQuestion {
  id: string;                    // UUID
  category: string;              // 题目类别
  type: string;                  // SINGLE_CHOICE | MULTIPLE_CHOICE
  text: string;                  // 题目内容
  options: {                      // JSON 数组
    id: string;
    text: string;
  }[];
  correct_option_ids: string[];   // ['A', 'B', ...] 或 ['A']
  explanation?: string;           // 可选解析
}
```

#### 上传策略
```
步骤1: 批量插入 (Batch Insert)
    ↓
成功? → 返回插入ID
    ↓
失败? → 降级为单条插入

目的: 平衡性能和可靠性
```

#### 错误恢复机制
```typescript
// 批量插入失败时的降级策略
for (const record of records) {
  try {
    // 单条插入
    const { data, error } = await supabase
      .from('questions')
      .insert([record])
      .select();
    
    if (error) {
      logger.error(`题目 "${record.text}" 插入失败`, error);
    }
  } catch (err) {
    logger.error(`网络错误`, err);
  }
}
```

---

## 数据流完整示例

### 输入文件示例
```
一、单项选择题
1. 马克思主义中国化的含义是？
   A. 将马克思主义应用到中国实践
   B. 改变马克思主义基本原理
   C. 中国化的马克思主义理论
   D. 以上都对

2. 中共一大的召开时间？
   A. 1921年7月 上海
   B. 1922年8月 杭州
   C. 1923年6月 北京
   D. 1924年5月 广州

答案：1.A 2.A

二、多项选择题
1. 实践证明，中国共产党为什么能？
   A. 正确的理论指导
   B. 强大的组织能力
   C. 深厚的群众基础
   D. 科学的决策机制

答案：1.ABCD
```

### 数据流转

```
📄 原始文本
  ↓
✂️ 文本切分 (3000字/片段)
  Chunk 1: "一、单项选择题\n1. 马克思...答案：1.A 2.A"
  Chunk 2: "二、多项选择题\n1. 实践...答案：1.ABCD"
  ↓
🤖 Ollama 处理
  AI Response 1:
  {
    "questions": [
      {
        "text": "马克思主义中国化的含义是？",
        "type": "SINGLE_CHOICE",
        "options": [
          { "id": "A", "text": "将马克思主义应用到中国实践" },
          { "id": "B", "text": "改变马克思主义基本原理" },
          { "id": "C", "text": "中国化的马克思主义理论" },
          { "id": "D", "text": "以上都对" }
        ],
        "answer": "A"
      },
      ...
    ]
  }
  ↓
🔄 格式映射
  ProcessedQuestion[]:
  [
    {
      text: "马克思主义中国化的含义是？",
      type: "SINGLE_CHOICE",
      options: [...],
      answer: "A"
    },
    ...
  ]
  ↓
✅ 5层验证
  ✓ 文本非空
  ✓ 选项数 >= 2
  ✓ 答案标签存在
  ✓ 答案与选项映射正确
  ✓ 题目类型有效
  ↓
💾 数据库映射
  DBQuestion[]:
  [
    {
      id: "550e8400-e29b-41d4-a716-446655440000",
      category: "毛概",
      type: "SINGLE_CHOICE",
      text: "马克思主义中国化的含义是？",
      options: [
        { id: "A", text: "将马克思主义应用到中国实践" },
        ...
      ],
      correct_option_ids: ["A"],
      explanation: null
    },
    ...
  ]
  ↓
📤 Supabase 上传
  → 批量插入 22 条记录
  → 返回插入成功的 ID
```

---

## 验证机制详解

### 5 层数据验证

```typescript
function validateQuestion(q: ProcessedQuestion): ValidationResult {
  // 第1层：文本完整性
  if (!q.text || q.text.trim().length === 0) {
    return { valid: false, reason: "题目文本为空" };
  }

  // 第2层：选项数量
  if (!q.options || q.options.length < 2) {
    return { valid: false, reason: "选项数少于2个" };
  }

  // 第3层：答案标签存在性
  const answerLabels = q.answer.split('');
  for (const label of answerLabels) {
    if (!q.options.find(opt => opt.id === label)) {
      return { valid: false, reason: `答案标签 ${label} 不存在` };
    }
  }

  // 第4层：类型校验
  if (q.type === 'SINGLE_CHOICE' && q.answer.length > 1) {
    return { valid: false, reason: "单选题答案不能多于1个" };
  }

  // 第5层：题目类型合法性
  if (!['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(q.type)) {
    return { valid: false, reason: `不支持的题目类型: ${q.type}` };
  }

  return { valid: true };
}
```

---

## 性能优化策略

### 1. 文本切分优化
```
原始文本 5000 字
  ↓
块大小 3000 字，重叠 200 字
  ↓
Chunk 1: 字 0-3000
Chunk 2: 字 2800-5000  (200字重叠，避免题目被切断)
  ↓
并行处理 Chunk 1 和 Chunk 2
  ↓
智能合并（去重）
```

### 2. 批量上传优化
```
22 条记录
  ↓
单次批量上传 (vs 逐条上传)
  ↓
性能提升 10 倍
  ↓
网络延迟从 22 * 100ms = 2.2s → 1 * 100ms = 0.1s
```

### 3. 错误恢复
```
批量上传失败
  ↓
自动降级为单条上传
  ↓
获得详细错误原因
  ↓
只有个别记录上传失败，其他记录全部保留
```

---

## 日志系统设计

### 日志级别与图标

```typescript
const logger = {
  // 信息日志 - 流程进度
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  
  // 成功日志 - 操作完成
  success: (msg: string) => console.log(`✅ ${msg}`),
  
  // 警告日志 - 需要注意
  warn: (msg: string) => console.warn(`⚠️  ${msg}`),
  
  // 错误日志 - 问题发生
  error: (msg: string, err?: any) => {
    console.error(`❌ ${msg}`);
    if (err) console.error(`   ${err.message}`);
  },
  
  // 调试日志 - 仅 DEBUG=true 时显示
  debug: (msg: string) => {
    if (process.env.DEBUG === 'true') {
      console.log(`🔍 ${msg}`);
    }
  }
};
```

### 日志输出示例

```
ℹ️  ========== 开始数据处理流程 ==========
ℹ️  文件路径: /project/Ti/t1.txt
ℹ️  题目类别: 毛概
ℹ️  → 正在读取文档...
✅ 文档读取完成，文本大小: 5234 字符

ℹ️  → 正在进行 AI 数据清洗处理...
ℹ️  已切分为 2 个片段

[AI 处理进度]
✅ 第 1 部分 AI 处理成功，返回 16 条记录
ℹ️  格式识别: questions (16 items)
✅ 验证通过: 16/16 题目有效

✅ 第 2 部分 AI 处理成功，返回 6 条记录
ℹ️  格式识别: questions (6 items)
✅ 验证通过: 6/6 题目有效

========== 处理统计 ==========
ℹ️  总处理: 22 题
✅ 有效题目: 22 题
⚠️  丢弃: 0 题

[数据库上传]
→ 正在上传题目到 Supabase...
✅ 批量上传成功！

========== 处理完成 ==========
✅ 上传题目数: 22
✅ 类别: 毛概
✅ 总耗时: 12.34 秒
```

---

## 扩展开发指南

### 添加新的文件格式支持

例：添加 PDF 支持

```typescript
// 1. textParser.ts 中添加
import PDFExtract from 'pdf-extract';

export async function extractTextFromPdf(filePath: string): Promise<string> {
  const pdfExtractor = new PDFExtract({}, (err, data) => {
    if (err) throw err;
    return data.text;
  });
  return new Promise((resolve, reject) => {
    pdfExtractor.extract(filePath, {}, (err, text) => {
      if (err) reject(err);
      resolve(text);
    });
  });
}

// 2. index.ts 中更新文件类型检测
if (fullPath.endsWith('.pdf')) {
  text = await extractTextFromPdf(fullPath);
}
```

### 自定义 AI 处理参数

在 `aiProcessor.ts` 中调整：

```typescript
// 调整温度参数（影响 AI 创意性）
const temperature = 0.2;  // 0=确定性强, 1=创意性强

// 调整 Top-K 采样（多样性）
const top_k = 40;  // 越小越集中，越大越多样

// 调整 Top-P 采样（控制概率范围）
const top_p = 0.9;  // 越高越多样
```

### 修改数据库表结构

如需添加新字段，修改上传逻辑：

```typescript
// uploader.ts
const record = {
  id: randomUUID(),
  category: categoryName,
  type: q.type,
  text: q.text,
  options: q.options,
  correct_option_ids: q.answer.split(''),
  explanation: null,           // 新增字段示例
  difficulty: 'medium',         // 新增字段示例
  custom_field: value           // 新增字段示例
};
```

---

## 故障诊断指南

### 调试流程

```
问题发现
  ↓
启用 DEBUG=true
  ↓
查看 AI 原始响应
  ↓
检查格式识别是否正确
  ↓
检查数据映射是否正确
  ↓
检查验证失败的原因
  ↓
定位问题所在
  ↓
修复或调整参数
```

### 常见问题排查

| 问题 | 排查步骤 |
|------|---------|
| AI 响应不含预期数据 | 1. 启用 DEBUG 2. 查看 AI 原始响应 3. 检查输入文本格式 4. 调整 System Prompt |
| 数据验证大量失败 | 1. 查看验证失败原因日志 2. 检查 AI 输出格式 3. 验证输入文件内容 |
| 上传到数据库失败 | 1. 检查网络连接 2. 验证 Supabase 凭证 3. 确认表结构 4. 查看权限设置 |
| 处理速度慢 | 1. 检查 Ollama 服务状态 2. 减少文本块大小 3. 检查系统资源占用 |

---

## 总结

PreQuestionBank 采用模块化、可扩展的设计：

✅ **清晰的职责分工** - 文本提取、AI 处理、数据验证、数据库上传各司其职
✅ **多层验证机制** - 确保数据质量
✅ **自动化的格式识别** - 适应多种 AI 输出格式
✅ **完善的错误处理** - 详细的日志和恢复机制
✅ **易于扩展** - 支持添加新的文件格式、数据库等

