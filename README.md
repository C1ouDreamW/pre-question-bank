# 🚀 PreQuestionBank | 刷题题库批量导入工具

<div align="center">

[![Ollama](https://img.shields.io/badge/Ollama-blue?logo=ollama)](https://ollama.com/)
[![qwen2.5](https://img.shields.io/badge/qwen2.5-brightgreen?logo=kubernetes)](https://qwen.ai/)
[![TypeScript](https://img.shields.io/badge/TypeScript-yellow?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-darkblue?logo=supabase)](https://supabase.com/)
![License](https://img.shields.io/badge/License-ISC-blue)

**ShuaShuaShua 刷题网站的题库批量导入工具**

[快速开始](./QUICK_REFERENCE.md) • [项目架构](./ARCHITECTURE.md) • [相关项目](https://github.com/C1ouDreamW/ShuaShuaShua)

</div>

---
## AI声明

本项目所有md文件均由AI总结生成，已经过人工审查并修改，如有问题请联系作者。

---

## 📖 简介

PreQuestionBank 是一个功能强大的题库批量导入工具，专为 **ShuaShuaShua** 刷题平台设计。它能够将任意格式的试题文本（`.txt`、`.docx`）自动转换为标准化数据格式，并批量导入到数据库。

**核心优势：**
- 🤖 **完全本地化** - 使用本地 Ollama + qwen2.5，无需云 API，数据安全可控
- ⚡ **开箱即用** - 5 分钟快速部署，无复杂配置
- 🎯 **智能识别** - AI 自动识别题目结构，支持单选/多选混合
- ✅ **质量保证** - 5 层数据验证，确保导入数据 100% 准确
- 📊 **实时反馈** - 详细的进度日志和错误提示

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 📄 **多格式支持** | 支持 `.txt` (UTF-8) 和 `.docx` 文件 |
| 🤖 **AI 智能处理** | 本地 Ollama qwen2.5 模型，无云依赖 |
| 🎯 **自动识别** | 智能识别单选题、多选题，自动清洗格式 |
| ✅ **5 层验证** | 文本完整性、选项数量、答案标签、映射关系、类型校验 |
| 📊 **详细日志** | 彩色输出，进度实时显示，问题快速定位 |
| 🔧 **调试模式** | 查看 AI 原始响应，排查格式问题 |
| ⚙️ **智能分块** | 自动切分大文本，保留上下文重叠 |
| 💾 **数据库集成** | 直接上传到 Supabase PostgreSQL |

---

## 📋 系统要求

```
Node.js      ≥ 14.0 (推荐 18+)
Ollama       最新版本
qwen2.5      模型（自动下载）
Supabase     任意版本
```

**操作系统:** Windows / macOS / Linux  
**磁盘空间:** ~5GB (用于 qwen2.5 模型)  
**网络:** 首次下载模型需要网络，之后完全离线工作

---

## 🚀 快速开始（5 分钟）

### 1️⃣ 环境准备

```bash
# 克隆项目
git clone https://github.com/C1ouDreamW/pre-question-bank.git
cd pre-question-bank

# 安装依赖
npm install
```

### 2️⃣ 启动 Ollama

```bash
# 启动 Ollama 服务（第一个终端）
ollama serve

# 另开终端，下载 qwen2.5 模型
ollama pull qwen2.5

# 验证 Ollama 正常运行
curl http://localhost:11434/api/tags
```

### 3️⃣ 配置数据库

```bash
# 复制配置模板
cp .env.example .env
```

编辑 `.env` 文件：
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
DEBUG=false
```

**获取 Supabase 凭证：**
1. 访问 [Supabase Dashboard](https://app.supabase.com)
2. 选择项目 → Settings → API
3. 复制 `Project URL` 和 `Service Role Key`

- 如需获得刷题网站Supabase数据库API，请联系作者

### 4️⃣ 准备试题文件

在项目目录放置试题文件，支持：

- **TXT 格式** (UTF-8 编码):
```
一、单项选择题
1. 题目文本？
   A. 选项A
   B. 选项B
   C. 选项C
   D. 选项D

2. 题目文本？
   A. 选项A
   B. 选项B
   ...

答案：1.A 2.B ...

二、多项选择题
1. 题目文本？
   A. 选项A
   B. 选项B
   C. 选项C
   D. 选项D

答案：1.AB ...
```

- **DOCX 格式**: 与 TXT 相同的内容格式，使用 Word 编辑

### 5️⃣ 运行导入

```bash
# 基本用法
npm start <文件路径> <题目类别>

# 示例 - 处理 TXT 文件
npm start ./Ti/t1.txt "毛概"

# 示例 - 处理 DOCX 文件
npm start ./docs/exam.docx "中国近代史"
```

---

## 📊 运行示例

```bash
$ npm start ./Ti/t1.txt "毛概"

ℹ️  ========== 开始数据处理流程 ==========
ℹ️  文件路径: C:\project\Ti\t1.txt
ℹ️  题目类别: 毛概
ℹ️  → 正在读取文档...
✅ 文档读取完成，文本大小: 5234 字符
ℹ️  → 正在进行 AI 数据清洗处理...
ℹ️  已切分为 2 个片段
✅ 第 1 部分 AI 处理成功，返回 16 条记录
✅ 第 2 部分 AI 处理成功，返回 6 条记录

========== 处理统计 ==========
ℹ️  总处理: 22 题
✅ 有效题目: 22 题
⚠️  丢弃: 0 题

✅ 成功提取 22 道有效题目
👀 预览第一题:
   题目: 马克思主义中国化的...
   类型: SINGLE_CHOICE
   选项: A, B, C, D
   答案: A

→ 正在上传题目到 Supabase...
✅ 成功导入 22 道题目！

========== 处理完成 ==========
✅ 上传题目数: 22
✅ 类别: 毛概
✅ 总耗时: 12.34 秒
```

---

## 📁 项目结构

```
pre-question-bank/
├── src/
│   ├── index.ts              # 📍 主入口 - 流程控制与参数验证
│   ├── aiProcessor.ts        # 🤖 AI 处理模块 - 调用 Ollama qwen2.5
│   ├── textParser.ts         # 📄 文本提取 - 支持 txt/docx
│   └── uploader.ts           # 💾 数据库上传 - Supabase 集成
├── Ti/
│   └── t1.txt               # 示例输入文件
├── .env.example             # 配置模板
├── .env                     # 实际配置（.gitignore）
├── package.json             # Node.js 依赖
├── tsconfig.json            # TypeScript 配置
└── README.md                # 本文档
```

---

## 🔍 核心流程

```
📄 输入文件 (txt/docx)
        ↓
📝 文本提取与清洗
        ↓
✂️  智能切分 (3000字/片段)
        ↓
🤖 Ollama qwen2.5 处理
        ↓
🔄 JSON 解析与映射
        ↓
✅ 5 层数据验证
        ↓
💾 Supabase 批量上传
        ↓
📊 成功统计反馈
```

### 各模块详解

#### 📍 index.ts - 主控模块
- 参数验证与日志初始化
- 流程编排与错误处理
- 执行时间统计

#### 🤖 aiProcessor.ts - AI 处理
- 调用本地 Ollama API
- 支持 7 种 JSON 格式自动识别
- 3 层响应验证
- 完整的错误恢复机制

#### 📄 textParser.ts - 文本提取
- TXT 文件（UTF-8 编码）
- DOCX 文件（mammoth 库）
- 编码自动检测

#### 💾 uploader.ts - 数据上传
- Supabase 批量插入
- 失败自动降级为单条插入
- 完整的错误报告

---

## ⚙️ 数据库表结构

自动创建的 `questions` 表：

```sql
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,                    -- 题目类别
  type TEXT NOT NULL,                        -- 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE'
  text TEXT NOT NULL,                        -- 题目内容
  options JSONB NOT NULL,                    -- [{ id: 'A', text: '选项文本' }, ...]
  correct_option_ids TEXT[] NOT NULL,        -- ['A', 'B', ...]
  explanation TEXT,                          -- 题目解析/答案说明
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX idx_questions_category ON questions(category);
CREATE INDEX idx_questions_type ON questions(type);
CREATE INDEX idx_questions_created_at ON questions(created_at);
```

---

## 🔧 配置说明

### 环境变量 (.env)

```env
# Supabase 连接信息
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# 调试模式（true 显示 AI 原始响应）
DEBUG=false
```

### 调整 AI 处理参数

编辑 `src/aiProcessor.ts`，可以调整：

```typescript
// 文本切分配置
const CHUNK_SIZE = 3000;                    // 每个片段大小
const CHUNK_OVERLAP = 200;                  // 片段重叠长度

// Ollama 参数
const temperature = 0.2;                    // 0=确定性, 1=随机性
const top_k = 40;                          // Top-K 采样
const top_p = 0.9;                         // Top-P 采样
```

---

## 🛠️ 故障排除

### ❗ 多选题识别为0

你最有可能遇到单选题和多选题混合时无法正确识别多选题的问题
如果遇到这种情况请查看[多选题出错解决方法](./MULTIPLE_CHOICE_ISSUE.md)

### ❌ "Ollama Error: connect ECONNREFUSED"

**原因:** Ollama 服务未启动或端口错误

**解决:**
```bash
# 启动 Ollama 服务
ollama serve

# 验证连接
curl http://localhost:11434/api/tags
```

### ❌ "Model 'qwen2.5' not found"

**原因:** 模型未下载

**解决:**
```bash
# 下载 qwen2.5 模型
ollama pull qwen2.5

# 查看已安装模型
ollama list
```

### ❌ "SUPABASE_URL 未配置"

**原因:** 缺少 `.env` 文件或配置不完整

**解决:**
```bash
# 复制配置模板
cp .env.example .env

# 编辑 .env，填入实际的 Supabase 信息
# Windows
notepad .env
# macOS/Linux
nano .env
```

### ❌ "JSON 解析失败" 或 "数据不合法"

**原因:** AI 输出格式异常或题目数据不完整

**解决:**
1. 启用调试模式查看 AI 原始响应：
```bash
# 修改 .env
DEBUG=true

# 重新运行
npm start ./Ti/t1.txt "毛概"
```

2. 检查输入文件格式是否标准：
   - 选项标签清晰（A、B、C、D）
   - 答案标注在文末
   - 编码为 UTF-8

3. 调整 System Prompt（`aiProcessor.ts` 中的 systemPrompt 变量）

### ❌ "Supabase 插入失败"

**原因:** 数据格式不符或权限不足

**解决:**
1. 启用 DEBUG=true 查看具体数据
2. 检查 `questions` 表是否存在
3. 验证 SERVICE_KEY 权限：
   - Dashboard → Roles → Service Role → 确保有表的完整权限

### ⚠️ AI 处理速度慢

**原因:** 模型文件大、硬件限制

**优化:**
- 使用 SSD 而非 HDD
- 增加系统 RAM（推荐 8GB+）
- 减少 CHUNK_SIZE（如改为 2000）
- 关闭其他占用资源的程序

---

## 📊 日志说明

程序使用不同图标标识不同日志级别：

| 图标 | 级别 | 说明 |
|------|------|------|
| `ℹ️` | INFO | 信息性日志 |
| `✅` | SUCCESS | 操作成功 |
| `⚠️` | WARN | 警告（需要关注） |
| `❌` | ERROR | 错误（可能中断） |
| `🔍` | DEBUG | 调试信息（需启用 DEBUG=true） |

---

## 💡 最佳实践

1. **文件格式**
   - 使用 UTF-8 编码
   - 选项标签清晰（A、B、C、D）
   - 在文末提供答案表：`答案：1.A 2.B 3.C ...`

2. **分批处理**
   - 大文件（>50KB）建议分成多个较小文件
   - 不同科目分开处理，便于管理和调试

3. **验证导入**
   ```sql
   -- 查看导入的题目数量
   SELECT category, COUNT(*) as count 
   FROM questions 
   GROUP BY category;

   -- 验证题目类型分布
   SELECT type, COUNT(*) as count 
   FROM questions 
   GROUP BY type;
   ```

4. **调试技巧**
   - 先用小文件测试，再处理大文件
   - 启用 DEBUG=true 观察 AI 响应格式
   - 查看详细日志找出数据验证失败原因

---

## 📈 性能参考

| 指标 | 典型值 |
|------|--------|
| 小文件 (<10KB) | ~3-5 秒 |
| 中文件 (10-50KB) | ~8-15 秒 |
| 大文件 (50-100KB) | ~20-40 秒 |
| 100 道题目 | ~10-15 秒 |

*依赖硬件配置和网络状况*

---

## 🔐 安全说明

- ✅ 所有数据处理完全本地化，不上传到云端
- ✅ Ollama 模型运行在本机，数据不出境
- ✅ 使用 SERVICE_KEY 而非 PUBLIC_KEY，权限更严格
- ⚠️ 请勿在公开仓库中提交 `.env` 文件（已在 `.gitignore`）
- ⚠️ 定期更新 npm 依赖，防止安全漏洞

---

## 📝 更新日志

### v1.0.0 (当前版本)
- ✅ 基础功能完整
- ✅ 支持单选/多选题
- ✅ 5 层数据验证
- ✅ 详细的错误处理和日志

### 规划中 (v1.1)
- 🔜 支持更多文件格式 (PDF, Excel)
- 🔜 Web UI 界面
- 🔜 批量文件处理
- 🔜 数据去重功能

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add AmazingFeature'`)
4. 推送分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 🙋 需要帮助？

1. 📖 查看 [详细文档](./docs/)
2. 🔍 启用 `DEBUG=true` 获取详细日志
3. 💬 提交 [Issue](https://github.com/C1ouDreamW/pre-question-bank/issues)
4. 📧 联系维护者

---

## 🌟 相关项目

- **[ShuaShuaShua](https://github.com/C1ouDreamW/ShuaShuaShua)** - 刷题网站主项目
- **[Ollama](https://github.com/jmorganca/ollama)** - 本地 LLM 运行框架
- **[Supabase](https://github.com/supabase/supabase)** - 开源数据库平台

---

<div align="center">

Made with ❤️ for ShuaShuaShua

[![Star on GitHub](https://img.shields.io/github/stars/C1ouDreamW/pre-question-bank?style=social)](https://github.com/C1ouDreamW/pre-question-bank)
[![Fork on GitHub](https://img.shields.io/github/forks/C1ouDreamW/pre-question-bank?style=social)](https://github.com/C1ouDreamW/pre-question-bank)

</div>
