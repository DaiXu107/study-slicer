# Study Slicer 扩展格式

Study Slicer 的扩展是**声明式 JSON**，不是代码。应用不会执行插件里的 JavaScript，也不会注入任意 CSS；主题只接受颜色 token（内置主题另有固定纹理），语言包只接受键值对翻译。

入口：设置 → 外观与扩展 → 导入主题包。

## 安全模型

- 只从本地文件导入 JSON，不自动联网。
- 主题包的每个 token 必须是 `#RRGGBB` 颜色，格式不对整包拒绝。
- 不执行 JS、不注入 CSS 片段、不允许 HTML。
- 自定义主题只保存在当前浏览器的 localStorage，可随时删除。
- API Key、课题、文献、全文和笔记不会暴露给扩展。

## 主题包

```json
{
  "schema": "study-slicer-plugin",
  "version": 1,
  "type": "theme",
  "id": "sakura-mist",
  "name": "樱雾",
  "author": "你的名字",
  "description": "柔和的樱粉色阅读主题。",
  "colorScheme": "light",
  "tokens": {
    "paper": "#faf5f6",
    "surface": "#ffffff",
    "done": "#f6f0f2",
    "ink": "#3a2830",
    "inkSoft": "#6f5a62",
    "inkFaint": "#a08e95",
    "line": "#eadde1",
    "accent": "#c96f8a",
    "accentSoft": "#f9e8ee",
    "accentDeep": "#a64865",
    "moss": "#7d9a7f",
    "mossSoft": "#eff4ee",
    "mossDeep": "#5c775f",
    "sun": "#e6b86b",
    "glow": "#ffffff"
  }
}
```

### 字段

| 字段 | 说明 |
| --- | --- |
| `schema` | 固定 `study-slicer-plugin` |
| `version` | 固定 `1` |
| `type` | 固定 `theme` |
| `id` | 小写字母 / 数字 / 连字符，2–41 位，不能与内置主题重名 |
| `name` | 主题名，最多 40 字 |
| `author` | 可选，最多 60 字 |
| `description` | 可选，最多 200 字 |
| `colorScheme` | `light` 或 `dark`，影响原生控件和滚动条 |
| `tokens` | 必须包含下列 15 个颜色 |

### Token 含义

| Token | 用途 |
| --- | --- |
| `paper` | 页面底色 |
| `surface` | 卡片 / 输入框 / 导航表面 |
| `done` | 已完成任务的卡片底色 |
| `ink` | 主文字、主按钮底色 |
| `inkSoft` | 次级文字 |
| `inkFaint` | 辅助文字、占位符 |
| `line` | 边框、分割线 |
| `accent` | 强调色（暖橙位） |
| `accentSoft` | 强调色的浅底 |
| `accentDeep` | 强调色的深字 |
| `moss` | 完成 / 正向色 |
| `mossSoft` | 完成色的浅底 |
| `mossDeep` | 完成色的深字 |
| `sun` | 点缀色 |
| `glow` | 页面顶部径向光晕 |

### 深色主题建议

- `colorScheme` 设为 `dark`。
- `paper` 深、`surface` 比 paper 略亮，保证卡片有层次。
- `ink` 用浅色，`line` 用低对比深灰。
- `accentSoft` / `mossSoft` 用深色底，配浅色 `accentDeep` / `mossDeep`。

## 语言包（格式预留，下一阶段启用）

完整语言切换需要先把界面文案抽成 key，目前尚未启用导入。格式如下，方便译者提前准备：

```json
{
  "schema": "study-slicer-plugin",
  "version": 1,
  "type": "locale",
  "id": "en",
  "name": "English",
  "locale": "en",
  "messages": {
    "nav.today": "Today",
    "nav.projects": "Projects",
    "nav.library": "Library",
    "nav.settings": "Settings"
  }
}
```

约定：

- `type` 为 `locale`，`id` 建议使用 BCP 47（如 `en`、`ja`、`zh-TW`）。
- `messages` 是扁平键值对，key 使用点号命名：`page.dashboard.title`、`wizard.step2.next`。
- 缺失 key 回退到简体中文。
- 不允许 HTML；插值将使用 `{name}` 形式。
- 语言包同样只存在本机，不联网。

## 贡献主题

1. 复制 `plugins/themes/sakura-mist.json`，改一套颜色。
2. 在应用里「外观与扩展」导入，确认浅色 / 深色、任务完成态、阅读器都正常。
3. 把 JSON 放到 `plugins/themes/`，提 PR；或在 Issue 里贴出 JSON 和截图。

内置的雪花 / 兰花 / 糖果主题会额外带一层内置背景纹理；自定义主题目前只改变颜色 token，不改变布局、字体、圆角或纹理。如果你需要更深的定制，欢迎在 Issue 里描述需求，再决定是否扩展 schema。
