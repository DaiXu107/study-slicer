# Study Slicer · 课题切片

把 PhD / 硕士课题切成「今天 45 分钟内能做完的一小块」。

纯前端单页应用：React + TypeScript + Tailwind CSS + Vite。没有账号、没有后端，所有课题、任务、笔记和设置都存在浏览器的 localStorage 里。

## 快速开始

```bash
npm install
npm run dev
```

打开终端里提示的地址（默认 `http://localhost:5173`）。

其他命令：

```bash
npm run typecheck   # TypeScript 类型检查
npm run build       # 类型检查 + 生产构建，产物在 dist/
npm run preview     # 本地预览生产构建
```

## 功能

### 四步课题向导

1. **设定课题**：课题标题、当前阶段（文献综述 / 理论框架 / 方法论设计 / 数据收集 / 分析 / 写作）、可选关键词。
2. **文献检索**：调用 OpenAlex（无需 Key），按被引数从高到低取 10 篇，展示标题、作者、年份、摘要前 200 字、被引数和原文链接。勾选 3–5 篇；接口失败时可直接手动录入文献。
3. **解读与方向**：调用 OpenAI 兼容接口，为每篇文献生成三句话解读，并给出 3 个可切入方向（含两句描述与可行性）。没配 API Key 时自动进入「可复制提示词」模式，并展示摘要，方便贴到 ChatGPT / Claude 里跑。方向可手动增删改。
4. **拆解每日任务**：让 AI 生成 10–15 个 20–45 分钟的任务，或按阶段模板本地生成 12 个。任务标题、描述、完成标准、日期、预计时长都可编辑或删除。

向导草稿会自动保存在 localStorage，刷新或暂时离开不会丢；每一步都能返回修改。

### 每日打卡

- 今日任务、连续打卡天数、本周完成率
- 勾选完成、记录完成时间、轻量 confetti 动画
- 每个任务可写一句笔记
- 完成后展示「明日预告」
- 今天没任务时，列出可以补做的过期任务

### 项目 / 文献库 / 设置

- **项目**：进度条、阶段标签、进入与删除
- **文献库**：所有已拉取文献、核心文献标记、AI 三句话解读、可编辑笔记
- **设置**：API Base URL、API Key、模型名、测试连接

## 配置 AI（可选）

在「设置」里填任意 **OpenAI 兼容**的 Chat Completions 接口：

- Base URL 填到 `/v1` 即可，例如 `https://api.openai.com/v1`；如果误填了完整 `/chat/completions` 地址也会自动处理。
- API Key 只保存在本机 localStorage，只会发送给你填写的接口地址。
- 默认模型：`gpt-4o-mini`。

**跨域提示**：浏览器会直接请求该接口。部分服务商不允许浏览器跨域访问（CORS），此时「测试连接」会失败；请换用允许浏览器访问的接口或自建代理。没有 Key 也不影响使用：AI 步骤会降级为「复制提示词」，任务步骤会降级为「阶段模板」。

## 数据与隐私

| localStorage key | 内容 |
| --- | --- |
| `study-slicer:v1` | 项目、任务、文献、方向、设置（含 API Key） |
| `study-slicer:draft:v1` | 未完成的向导草稿 |

- 没有服务器，没有埋点，没有登录。
- 清理浏览器数据 / 换设备会丢失内容，重要笔记请自行备份。
- API Key 存在浏览器本地，不要在共享设备上填写。

## 关于 OpenAlex

- 无需注册或 API Key。
- 检索请求按需求使用 `sort=cited_by_count:desc`，因此结果更偏「领域内高被引」而不是「与你最相关」。
- OpenAlex 对英文关键词更敏感；中文课题建议先用英文关键词检索一次。
- 部分文献没有公开摘要，可以手动补录。

## 目录结构

```
study-slicer/
├── index.html
├── src/
│   ├── App.tsx                 # 路由
│   ├── main.tsx
│   ├── index.css               # Tailwind + 基础样式 / 按钮 / 输入框
│   ├── types.ts                # Project / Paper / Direction / DailyTask
│   ├── components/
│   │   ├── Layout.tsx          # 页面容器 + 底部导航
│   │   ├── TaskCard.tsx        # 打卡任务卡片
│   │   ├── Confetti.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── StageBadge.tsx
│   │   └── Icons.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx       # 今日打卡
│   │   ├── Projects.tsx
│   │   ├── Wizard.tsx          # 四步向导
│   │   ├── Library.tsx
│   │   └── Settings.tsx
│   ├── lib/
│   │   ├── openalex.ts         # OpenAlex 检索 + 摘要还原
│   │   ├── llm.ts              # OpenAI 兼容调用 / JSON 解析
│   │   ├── prompts.ts          # 解读、方向、任务、复制提示词
│   │   ├── fallbackTasks.ts    # 六阶段本地任务模板
│   │   ├── date.ts             # 打卡 streak / 周完成率
│   │   ├── draft.ts            # 向导草稿持久化
│   │   └── utils.ts
│   └── store/
│       └── AppContext.tsx      # localStorage 状态与增删改
├── tailwind.config.js
├── vite.config.ts
└── tsconfig.json
```

## 已知限制

- 数据只在本机，暂不支持云同步或导出。
- 浏览器直连 LLM 可能受 CORS 限制。
- AI 输出质量取决于所选模型；所有生成内容都设计成可手动修改。
- OpenAlex 的按被引排序可能带出领域外的经典文献，可通过更精确的关键词重搜或手动录入。

## 参与贡献

欢迎提 Issue 或 PR：修 bug、补阶段模板、加语言、改进提示词都可以。Fork 之后：

```bash
npm install
npm run dev
```

## License

[MIT](./LICENSE) © 2026 DaiXu107

