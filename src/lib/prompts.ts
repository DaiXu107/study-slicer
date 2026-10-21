import type { Direction, Paper, Stage } from '../types';
import { pluralAuthors } from './utils';

export const STAGE_STRATEGY: Record<Stage, string> = {
  文献综述:
    '偏“读 + 写摘要”：精读、做文献对比表、画概念地图、写研究缺口。任务要产出可复用的笔记或表格。',
  理论框架:
    '偏“概念界定 + 关系图”：澄清概念、画变量关系、提出可检验假设，并写清理论选择的理由。',
  方法论设计:
    '偏“对比方法 + 写决策记录”：比较候选方法、说明取舍、设计流程与效度保障，每一步留下决策记录。',
  数据收集:
    '偏“小批量推进 + 质检”：准备工具、联系参与者、预收集、数据备份与质量检查，避免一口气铺太大。',
  分析:
    '偏“单步分析 + 可复现”：一次只跑一个分析、保存脚本、画图、做稳健性检查，并写结果描述。',
  写作:
    '偏“每天 300 字小节”：只写一个论点，先出草稿再删改，统一术语，定期发给导师可读草稿。',
};

function paperBlock(paper: Paper, index: number): string {
  const abstract = paper.abstract
    ? paper.abstract.replace(/\s+/g, ' ').slice(0, 1400)
    : '（无摘要）';
  return [
    `[文献 ${index + 1}]`,
    `paperId: ${paper.id}`,
    `标题：${paper.title}`,
    `作者：${pluralAuthors(paper.authors)}`,
    `年份：${paper.year ?? '未知'}`,
    `被引：${paper.citedByCount}`,
    `摘要：${abstract}`,
  ].join('\n');
}

export interface AnalysisResult {
  interpretations?: Array<{ paperId?: string; text?: string }>;
  directions?: Array<{ title?: string; description?: string; feasibility?: string }>;
}

export function buildAnalysisPrompt(
  projectTitle: string,
  stage: Stage,
  keywords: string,
  papers: Paper[]
): string {
  return [
    '你是一位耐心、具体、不空话连篇的博士导师，正在帮学生把课题落到可执行的研究方向上。',
    '',
    `学生课题：${projectTitle}`,
    `当前阶段：${stage}`,
    keywords.trim() ? `补充关键词：${keywords.trim()}` : '',
    '',
    '请阅读以下学生选中的文献：',
    '',
    papers.map(paperBlock).join('\n\n'),
    '',
    '请完成两件事：',
    '1. 为每一篇文献写恰好 3 句中文解读，分别对应：研究问题 / 使用方法 / 与这个课题的关系。不要复述摘要，要给出判断。',
    '2. 提出恰好 3 个可切入的研究方向。标题不超过 20 字；描述恰好 2 句，具体到“可以做什么”；可行性只能是“高”“中”“低”之一。',
    '',
    '严格只输出以下 JSON，不要 markdown 代码块，不要额外解释：',
    '{"interpretations":[{"paperId":"原样返回文献的 paperId","text":"三句话解读"}],"directions":[{"title":"方向标题","description":"两句描述","feasibility":"高"}]}',
  ]
    .filter(Boolean)
    .join('\n');
}

export interface TaskGenResult {
  tasks?: Array<{
    dayOffset?: number;
    title?: string;
    description?: string;
    criteria?: string;
    minutes?: number;
  }>;
}

export function buildTaskPrompt(
  projectTitle: string,
  stage: Stage,
  directions: Direction[],
  startDate: string,
  strict = false
): string {
  const directionText = directions
    .map((d, i) => `${i + 1}. ${d.title}：${d.description}（可行性：${d.feasibility}）`)
    .join('\n');

  return [
    '你是一位擅长把研究拆成每日行动的研究教练。学生容易焦虑，所以任务要小、具体、能立刻开始。',
    '',
    `课题：${projectTitle}`,
    `阶段：${stage}`,
    `已选研究方向：`,
    directionText,
    '',
    `从 ${startDate} 开始，把接下来的工作拆成 10–15 个每日任务。`,
    '硬性要求：',
    '- 每个任务 20–45 分钟内能做完，不要出现“读完整个领域”这种模糊任务；',
    '- 同一天最多安排 2 个任务，按天循序渐进；',
    '- 每个任务都要有可检查的完成标准（做到什么算完成），不要写“理解”“熟悉”这类无法验证的词；',
    '- 任务之间不要重复，后面的任务可以建立在前面的产出上；',
    '- 只拆解上面列出的方向，不要自行新增研究方向；',
    `- 阶段策略：${STAGE_STRATEGY[stage]}`,
    strict
      ? [
          '',
          '【严格模式约束】',
          '- 用户自己负责文献解读与研究方向的全部内容。你只做行动规划。',
          '- 不得新增、改写或扩展研究方向，不得替用户写研究结论、文献解读或学术观点。',
          '- 任务标题与描述只写“做什么、怎么做、产出什么”，不得包含新的研究判断。',
          '- 输入中没有文献摘要，不要猜测或补写文献内容。',
        ].join('\n')
      : '',
    '',
    '严格只输出以下 JSON，不要 markdown 代码块，不要额外解释：',
    '{"tasks":[{"dayOffset":0,"title":"20 字以内的任务标题","description":"一两句怎么做","criteria":"一句话完成标准","minutes":30}]}',
    'dayOffset 从 0 开始（0 表示开始当天），依次递增。',
  ].join('\n');
}

/** 没有 API Key 时，给用户一段可以贴到 ChatGPT / Claude 的完整提示词 */
export function buildCopyPrompt(
  projectTitle: string,
  stage: Stage,
  keywords: string,
  papers: Paper[]
): string {
  return [
    '我正在做一项研究，需要你帮我读文献并提炼研究方向。',
    '',
    `课题：${projectTitle}`,
    `阶段：${stage}`,
    keywords.trim() ? `关键词：${keywords.trim()}` : '',
    '',
    '下面是我选中的核心文献：',
    '',
    papers
      .map(
        (p, i) =>
          `【${i + 1}】${p.title}（${p.year ?? '年份未知'}，${pluralAuthors(
            p.authors
          )}，被引 ${p.citedByCount}）\n摘要：${p.abstract || '（无摘要）'}`
      )
      .join('\n\n'),
    '',
    '请输出两部分，用中文，具体、不空泛：',
    '一、文献解读。每篇 3 句话，分别说明：研究问题 / 使用方法 / 与我的课题有什么关系。',
    '二、研究方向。给出 3 个我可能切入的方向，每个包含：',
    '   1. 标题（20 字以内）',
    '   2. 两句描述：具体可以做什么、为什么成立',
    '   3. 可行性：高 / 中 / 低，并用一句话说明理由',
    '',
    '请直接开始，不要客套。',
  ]
    .filter(Boolean)
    .join('\n');
}
