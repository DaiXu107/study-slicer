import type { DailyTask, Direction, Stage } from '../types';
import { addDays, todayStr } from './date';
import { uid } from './utils';

interface Template {
  title: string;
  description: string;
  criteria: string;
  minutes: number;
}

/** 每个阶段 12 个手工模板，保证没有 API Key 也能立刻开始 */
const TEMPLATES: Record<Stage, Template[]> = {
  文献综述: [
    {
      title: '定位「{dir}」的 2 篇关键文献',
      description: '从已选文献的参考文献里顺藤摸瓜，先读标题和摘要，不急着读全文。',
      criteria: '选出 2 篇，并各写一句“为什么关键”。',
      minutes: 30,
    },
    {
      title: '精读 1 篇综述并写 3 句摘要',
      description: '只读引言、框架图和结论，别从头啃到尾。',
      criteria: '三句话分别写清问题、方法、结论。',
      minutes: 45,
    },
    {
      title: '做一张文献对比表',
      description: '列“问题 / 样本 / 方法 / 结论”四列，先从 3 篇开始。',
      criteria: '表格至少 3 行，每格都有内容。',
      minutes: 40,
    },
    {
      title: '画「{dir}」的概念地图',
      description: '在纸上画节点和箭头，标出核心概念与争议点。',
      criteria: '至少 8 个节点、5 条关系。',
      minutes: 30,
    },
    {
      title: '找 2 个互相矛盾的研究',
      description: '专门搜反例，看看相似问题为什么会得出不同结论。',
      criteria: '写下两篇的分歧点和可能原因。',
      minutes: 35,
    },
    {
      title: '写 200 字研究缺口',
      description: '基于对比表，指出还没被回答的那个具体问题。',
      criteria: '明确写出 1 个缺口，不用“研究较少”糊弄。',
      minutes: 30,
    },
    {
      title: '更新一次检索式',
      description: '根据读到的术语补充同义词，重新搜 10 篇。',
      criteria: '检索式含 3 组关键词，新增 2 篇候选。',
      minutes: 25,
    },
    {
      title: '精读一篇高被引文献的方法部分',
      description: '重点看它怎么定义变量、怎么收集数据。',
      criteria: '记下 3 个可借鉴的做法。',
      minutes: 45,
    },
    {
      title: '写 300 字综述段落',
      description: '围绕一个主题把 3 篇文献串起来，不要逐篇罗列。',
      criteria: '一段连贯文字，含 3 处引用。',
      minutes: 40,
    },
    {
      title: '整理今天新增的参考文献',
      description: '把文献录入文献库，统一作者、年份、标题格式。',
      criteria: '随机抽查 5 条，信息无误。',
      minutes: 25,
    },
    {
      title: '重画概念地图并做减法',
      description: '回看之前的图，删掉与课题无关的枝节。',
      criteria: '节点变少但主链清晰，能一句话讲明白。',
      minutes: 25,
    },
    {
      title: '写本周复盘与下周清单',
      description: '哪些读懂了、哪里卡住、下周先做什么。',
      criteria: '5 行以内，含 1 个下周第一步。',
      minutes: 20,
    },
  ],
  理论框架: [
    {
      title: '写下「{dir}」的 3 个核心概念',
      description: '每个概念用一句话定义，注明来自哪篇文献。',
      criteria: '3 个定义都能被同行看懂。',
      minutes: 30,
    },
    {
      title: '区分概念与它的近义词',
      description: '找 2 个容易混淆的词，写清差别。',
      criteria: '各写一句“不是……而是……”。',
      minutes: 25,
    },
    {
      title: '画变量关系图',
      description: '把自变量、因变量、调节或中介变量画在一张图上。',
      criteria: '每个箭头旁写一句理论依据。',
      minutes: 40,
    },
    {
      title: '读 1 篇理论奠基文献',
      description: '只读理论提出部分和讨论，关注它的适用边界。',
      criteria: '写下 2 条适用条件、1 条不适用场景。',
      minutes: 45,
    },
    {
      title: '对比 2 个竞争理论',
      description: '它们对同一现象的解释哪里不同？',
      criteria: '列出 3 条差异，并注明各自证据。',
      minutes: 35,
    },
    {
      title: '写 200 字理论立场',
      description: '明确你采用哪个框架，为什么不是另一个。',
      criteria: '有立场、有理由、有边界。',
      minutes: 30,
    },
    {
      title: '给每个概念找可测指标',
      description: '把抽象概念落到问卷题项或可观察的行为指标。',
      criteria: '每个概念至少对应 1 个指标。',
      minutes: 35,
    },
    {
      title: '为框架写 3 条可检验假设',
      description: '用“如果……那么……”的句式，避免同义反复。',
      criteria: '每条都能设计一个验证方式。',
      minutes: 30,
    },
    {
      title: '找 2 篇使用该框架的实证研究',
      description: '看别人怎么测量、怎么分析。',
      criteria: '记录它们的测量方式和主要发现。',
      minutes: 40,
    },
    {
      title: '写框架小节初稿 300 字',
      description: '按“概念—关系—假设”的顺序写。',
      criteria: '逻辑链完整，能被单独阅读。',
      minutes: 45,
    },
    {
      title: '自查框架的 3 个漏洞',
      description: '假设自己是审稿人，专门挑刺。',
      criteria: '写下 3 条质疑，各配 1 条应对。',
      minutes: 25,
    },
    {
      title: '修订框架图与假设',
      description: '根据前一天的质疑删改，而不是全部推翻。',
      criteria: '至少改动 1 处，并说明为什么。',
      minutes: 30,
    },
  ],
  方法论设计: [
    {
      title: '把研究问题映射到方法',
      description: '每个子问题对应哪种数据、哪种分析，先写清楚。',
      criteria: '写出 3 行“问题 → 方法”。',
      minutes: 25,
    },
    {
      title: '对比 2 种候选方法',
      description: '从成本、效度、可行性三个维度比较。',
      criteria: '每种方法各写 3 条优劣。',
      minutes: 40,
    },
    {
      title: '写 200 字方法选择理由',
      description: '解释为什么选 A 不选 B，也承认它放弃了什么。',
      criteria: '含 1 条明确的取舍。',
      minutes: 30,
    },
    {
      title: '画数据收集流程图',
      description: '从招募到归档，画出每一步和决策点。',
      criteria: '5 步以上，标出可能卡住的地方。',
      minutes: 35,
    },
    {
      title: '写样本与纳入标准',
      description: '谁进入研究、谁排除、为什么。',
      criteria: '标准具体到别人能照着执行。',
      minutes: 30,
    },
    {
      title: '做一次预实验或模拟',
      description: '找 1 位同学试跑流程，或自己完整模拟一遍。',
      criteria: '记录 3 个发现和 1 处修改。',
      minutes: 45,
    },
    {
      title: '列出效度威胁与对策',
      description: '想清楚什么情况会让结论不成立。',
      criteria: '3 个威胁，每个配 1 条对策。',
      minutes: 30,
    },
    {
      title: '写方法决策记录',
      description: '记录今天为什么这样设计，留给三个月后的自己。',
      criteria: '含背景、选项、决定、代价四部分。',
      minutes: 25,
    },
    {
      title: '估算时间与资源',
      description: '给每个环节一个天数和所需资源。',
      criteria: '总时长与截止日期能对上。',
      minutes: 25,
    },
    {
      title: '准备伦理与知情同意清单',
      description: '列出需要审批、告知、保存的材料。',
      criteria: '清单不少于 5 项。',
      minutes: 30,
    },
    {
      title: '请导师或同门审阅方法草案',
      description: '只问 3 个具体问题，别泛泛求意见。',
      criteria: '记录 3 条可执行的修改建议。',
      minutes: 40,
    },
    {
      title: '修订方法部分 300 字',
      description: '根据反馈修改，删掉“适当”“一定程度”这类模糊表述。',
      criteria: '每个方法选择都有理由。',
      minutes: 40,
    },
  ],
  数据收集: [
    {
      title: '检查收集工具',
      description: '问卷、脚本、设备都完整试跑一遍。',
      criteria: '走完整个流程，无报错。',
      minutes: 30,
    },
    {
      title: '联系 2 位潜在参与者',
      description: '发出邀请，说明时间、用途和退出方式。',
      criteria: '发出 2 封邀请并记录回复状态。',
      minutes: 25,
    },
    {
      title: '完成 1 次预收集',
      description: '只做 1 个样本，重点记录卡点，不追求数量。',
      criteria: '记录耗时、问题和 1 处改进。',
      minutes: 45,
    },
    {
      title: '统一数据命名与目录',
      description: '定好文件命名规则和存放位置，避免以后找不到。',
      criteria: '新建目录，并写下命名说明。',
      minutes: 20,
    },
    {
      title: '收集并录入第一批数据',
      description: '小批量开始，边收边核对。',
      criteria: '抽取 10% 做双人核对，错误率为 0。',
      minutes: 45,
    },
    {
      title: '写数据质量检查清单',
      description: '缺失、重复、异常值分别怎么查。',
      criteria: '至少 5 项，每项可执行。',
      minutes: 25,
    },
    {
      title: '处理 1 个异常样本',
      description: '判断它是录入错误还是真实异常。',
      criteria: '写下判断依据和处理方式。',
      minutes: 25,
    },
    {
      title: '更新数据进度表',
      description: '目标多少、已完成多少、还差谁。',
      criteria: '完成率和缺口一目了然。',
      minutes: 20,
    },
    {
      title: '备份今天的数据',
      description: '本地和云端各存一份，并确认能打开。',
      criteria: '随机打开 1 个文件验证。',
      minutes: 15,
    },
    {
      title: '写 150 字收集日志',
      description: '记录一个意外发现，或一次失败。',
      criteria: '具体到时间、对象、现象。',
      minutes: 20,
    },
    {
      title: '检查缺失值与编码',
      description: '统计缺失率，检查分类编码是否一致。',
      criteria: '输出一张缺失率表。',
      minutes: 35,
    },
    {
      title: '复盘收集节奏',
      description: '现在的速度能持续到截止日期吗？',
      criteria: '得出结论，并调整下周目标。',
      minutes: 20,
    },
  ],
  分析: [
    {
      title: '明确分析问题与变量',
      description: '这次分析回答什么，用哪些变量。',
      criteria: '列出 3 组“问题—变量—方法”。',
      minutes: 25,
    },
    {
      title: '做描述性统计或初步编码',
      description: '先看数据长什么样，不急着做检验。',
      criteria: '输出 1 张描述统计表或编码表。',
      minutes: 40,
    },
    {
      title: '检查分布与异常值',
      description: '画直方图或箱线图，判断是否需要处理。',
      criteria: '记录判断依据，不擅自删数据。',
      minutes: 35,
    },
    {
      title: '跑第一轮主分析',
      description: '只跑一个核心模型，保存脚本和输出。',
      criteria: '结果可复现，脚本有注释。',
      minutes: 45,
    },
    {
      title: '画 1 张核心结果图',
      description: '选最能说明问题的那张图，认真做图注。',
      criteria: '图注脱离正文也能读懂。',
      minutes: 40,
    },
    {
      title: '做一次稳健性检查',
      description: '换一种设定或子样本，看结论是否变化。',
      criteria: '记录结果变化与否。',
      minutes: 45,
    },
    {
      title: '写 200 字结果描述',
      description: '只描述，不解释，不夸大。',
      criteria: '每个数字都能在输出里找到。',
      minutes: 30,
    },
    {
      title: '设想 1 个替代解释',
      description: '还有什么原因能解释这个结果？',
      criteria: '写 3 句，并说明如何排除。',
      minutes: 25,
    },
    {
      title: '整理分析日志',
      description: '记录今天跑过的每一步和参数。',
      criteria: '别人能照着复现。',
      minutes: 20,
    },
    {
      title: '与文献结果对照',
      description: '你的结果和已有研究一致吗？',
      criteria: '写 2 个一致点、1 个不一致点。',
      minutes: 40,
    },
    {
      title: '请同门复现一个结果',
      description: '把脚本或步骤发给对方试跑。',
      criteria: '记录差异并定位原因。',
      minutes: 30,
    },
    {
      title: '复盘：还缺哪个分析',
      description: '对照研究问题，找漏掉的部分。',
      criteria: '列出 1 个待补分析，排进明天。',
      minutes: 20,
    },
  ],
  写作: [
    {
      title: '写 300 字「{dir}」小节',
      description: '只写一个论点，先不管文采。',
      criteria: '300 字左右，论点在第一句。',
      minutes: 45,
    },
    {
      title: '搭本节三级提纲',
      description: '每一小节用一句话写主旨。',
      criteria: '三级标题齐全，逻辑不重复。',
      minutes: 25,
    },
    {
      title: '写 300 字引言片段',
      description: '交代问题、研究缺口、本文要做什么。',
      criteria: '三件事各占一段。',
      minutes: 45,
    },
    {
      title: '把 1 张图改写成 150 字正文',
      description: '用文字讲清图里的趋势和例外。',
      criteria: '图与文不重复，数字准确。',
      minutes: 30,
    },
    {
      title: '写 300 字方法片段',
      description: '讲清数据、样本、分析，含一个关键决策。',
      criteria: '别人能据此复现。',
      minutes: 45,
    },
    {
      title: '写 300 字结果片段',
      description: '按“发现—证据—边界”组织。',
      criteria: '每个结论都有数字支撑。',
      minutes: 40,
    },
    {
      title: '写 300 字讨论片段',
      description: '连接 1 篇文献，说明一致或不同。',
      criteria: '有引用、有解释、不过度推断。',
      minutes: 45,
    },
    {
      title: '删掉 10% 的冗余词',
      description: '专删“非常”“一定程度上”这类词。',
      criteria: '字数减少约 10%，意思不变。',
      minutes: 25,
    },
    {
      title: '通读并标出逻辑跳跃',
      description: '在段与段之间找缺失的那一步。',
      criteria: '标出 3 处，各补 1 句过渡。',
      minutes: 30,
    },
    {
      title: '统一术语与格式',
      description: '同一个概念只用一个词，检查图表编号。',
      criteria: '全文搜索替换一遍。',
      minutes: 25,
    },
    {
      title: '给导师发一版可读草稿',
      description: '附上 3 个具体问题，降低对方回复成本。',
      criteria: '邮件发出，问题明确。',
      minutes: 30,
    },
    {
      title: '复盘本周写作字数',
      description: '统计产出，找出最耗时的环节。',
      criteria: '写下下周的写作目标。',
      minutes: 20,
    },
  ],
};

export function buildFallbackTasks(params: {
  projectTitle: string;
  stage: Stage;
  directions: Direction[];
  startDate?: string;
}): DailyTask[] {
  const { projectTitle, stage, directions } = params;
  const start = params.startDate ?? todayStr();
  const templates = TEMPLATES[stage] ?? TEMPLATES['文献综述'];
  const directionTitles = directions.map((d) => d.title).filter(Boolean);

  return templates.map((tpl, index) => {
    const linked = directions.length ? directions[index % directions.length] : undefined;
    const dirName = linked?.title || projectTitle;
    return {
      id: uid('task-'),
      date: addDays(start, index),
      title: tpl.title.replace('{dir}', dirName),
      description: tpl.description,
      criteria: tpl.criteria,
      minutes: tpl.minutes,
      linkedDirectionId: linked?.id,
      done: false,
      note: '',
    };
  });
}

/** 手动补一条任务时的默认值 */
export function makeEmptyTask(date: string, directionId?: string): DailyTask {
  return {
    id: uid('task-'),
    date,
    title: '',
    description: '',
    criteria: '',
    minutes: 30,
    linkedDirectionId: directionId,
    done: false,
    note: '',
  };
}
