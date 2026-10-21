import type { Paper } from '../types';
import { normalizeDoi } from './utils';

export type CitationStyle =
  | 'apa'
  | 'mla'
  | 'chicago'
  | 'gbt7714'
  | 'ieee'
  | 'bibtex'
  | 'ris';

export interface CitationStyleInfo {
  id: CitationStyle;
  label: string;
  description: string;
  ext: string;
  monospace?: boolean;
}

export const CITATION_STYLES: CitationStyleInfo[] = [
  { id: 'apa', label: 'APA 7', description: '作者-年份，社科常用', ext: 'txt' },
  { id: 'mla', label: 'MLA 9', description: '人文学科常用', ext: 'txt' },
  { id: 'chicago', label: 'Chicago', description: '作者-年份制', ext: 'txt' },
  { id: 'gbt7714', label: 'GB/T 7714', description: '中文期刊 / 学位论文', ext: 'txt' },
  { id: 'ieee', label: 'IEEE', description: '工程 / 计算机常用', ext: 'txt' },
  {
    id: 'bibtex',
    label: 'BibTeX',
    description: 'LaTeX / Zotero 可导入',
    ext: 'bib',
    monospace: true,
  },
  {
    id: 'ris',
    label: 'RIS',
    description: 'EndNote / Zotero 可导入',
    ext: 'ris',
    monospace: true,
  },
];

const clean = (value?: string): string => (value ?? '').replace(/\s+/g, ' ').trim();
const hasCJK = (value: string): boolean => /[㐀-鿿]/.test(value);
const yearOf = (paper: Paper): string => (paper.year ? String(paper.year) : 'n.d.');
const titleOf = (paper: Paper): string => clean(paper.title) || 'Untitled';

function linkOf(paper: Paper): string {
  if (paper.doi) return `https://doi.org/${normalizeDoi(paper.doi)}`;
  return clean(paper.url);
}

function withPeriod(value: string): string {
  const text = clean(value);
  if (!text) return '';
  return /[.!?。！？]$/.test(text) ? text : `${text}.`;
}

function quoteTitle(paper: Paper): string {
  const title = titleOf(paper);
  return /[.!?。！？]$/.test(title) ? `"${title}"` : `"${title}."`;
}

interface NameParts {
  family: string;
  given: string;
}

const CORPORATE_WORDS =
  /\b(World|Organization|Organisation|Association|Institute|University|Department|Ministry|National|Center|Centre|Agency|Committee|Council|Group|Consortium|Foundation|Society|Federation|Office|Commission)\b/i;

/** 启发式拆分姓名：有逗号按“姓, 名”，否则最后一个词当姓；中文名和机构名原样保留。 */
function splitName(raw: string): NameParts {
  const name = clean(raw);
  if (!name) return { family: '', given: '' };
  if (name.includes(',')) {
    const [family, ...rest] = name.split(',');
    return { family: family.trim(), given: rest.join(',').trim() };
  }
  if (hasCJK(name)) return { family: name, given: '' };
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 1) return { family: name, given: '' };
  if (parts.length >= 3 && CORPORATE_WORDS.test(name)) {
    return { family: name, given: '' };
  }
  return {
    family: parts[parts.length - 1],
    given: parts.slice(0, -1).join(' '),
  };
}

function initials(given: string, separator = ' '): string {
  return given
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      const word = part.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ-]/g, '');
      return word ? `${word[0].toUpperCase()}.` : '';
    })
    .filter(Boolean)
    .join(separator);
}

function apaName(raw: string): string {
  const { family, given } = splitName(raw);
  if (!family) return '';
  return given ? `${family}, ${initials(given)}` : family;
}

function apaAuthors(authors: string[]): string {
  const names = authors.map(apaName).filter(Boolean);
  if (!names.length) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
}

function mlaName(raw: string, inverted: boolean): string {
  const { family, given } = splitName(raw);
  if (!family) return '';
  if (!given) return family;
  return inverted ? `${family}, ${given}` : `${given} ${family}`;
}

function mlaAuthors(authors: string[]): string {
  const list = authors.filter((a) => clean(a));
  if (!list.length) return '';
  if (list.length === 1) return `${mlaName(list[0], true)}.`;
  if (list.length === 2) {
    return `${mlaName(list[0], true)}, and ${mlaName(list[1], false)}.`;
  }
  return `${mlaName(list[0], true)}, ${hasCJK(list[0]) ? '等.' : 'et al.'}`;
}

function chicagoAuthors(authors: string[]): string {
  const list = authors.filter((a) => clean(a));
  if (!list.length) return '';
  if (list.length === 1) return `${mlaName(list[0], true)}.`;
  const names = [
    mlaName(list[0], true),
    ...list.slice(1).map((name) => mlaName(name, false)),
  ].filter(Boolean);
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}.`;
}

function gbtName(raw: string): string {
  const name = clean(raw);
  if (!name) return '';
  const { family, given } = splitName(name);
  if (!given) return hasCJK(name) ? name : family;
  return `${family.toUpperCase()} ${initials(given, '')}`.replace(/\./g, '').trim();
}

function gbtAuthors(authors: string[]): string {
  const names = authors.map(gbtName).filter(Boolean);
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')}, 等`;
}

function ieeeName(raw: string): string {
  const { family, given } = splitName(raw);
  if (!family) return '';
  return given ? `${initials(given)} ${family}`.trim() : family;
}

function ieeeAuthors(authors: string[]): string {
  const names = authors.map(ieeeName).filter(Boolean);
  if (!names.length) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function bibName(raw: string): string {
  const { family, given } = splitName(raw);
  if (!family) return '';
  return given ? `${family}, ${given}` : family;
}

function risName(raw: string): string {
  return bibName(raw);
}

function apaSource(paper: Paper): string {
  if (!paper.journal) return '';
  let source = paper.journal;
  if (paper.volume) source += `, ${paper.volume}`;
  if (paper.issue) source += `(${paper.issue})`;
  if (paper.pages) source += `, ${paper.pages}`;
  return withPeriod(source);
}

function mlaSource(paper: Paper): string {
  const year = yearOf(paper);
  if (!paper.journal) return `${year}.`;
  let source = paper.journal;
  if (paper.volume) source += `, vol. ${paper.volume}`;
  if (paper.issue) source += `, no. ${paper.issue}`;
  source += `, ${year}`;
  if (paper.pages) source += `, pp. ${paper.pages}`;
  return `${source}.`;
}

function chicagoSource(paper: Paper): string {
  if (!paper.journal) return '';
  let source = paper.journal;
  if (paper.volume) source += ` ${paper.volume}`;
  if (paper.issue) source += ` (${paper.issue})`;
  if (paper.pages) source += `: ${paper.pages}`;
  return withPeriod(source);
}

function formatAPA(paper: Paper): string {
  const authors = apaAuthors(paper.authors);
  const year = yearOf(paper);
  const title = withPeriod(titleOf(paper));
  const source = apaSource(paper);
  const link = linkOf(paper);

  if (!authors) {
    return [title, `(${year}).`, source, link].filter(Boolean).join(' ');
  }
  return [`${authors} (${year}).`, title, source, link].filter(Boolean).join(' ');
}

function formatMLA(paper: Paper): string {
  return [
    mlaAuthors(paper.authors),
    quoteTitle(paper),
    mlaSource(paper),
    linkOf(paper),
  ]
    .filter(Boolean)
    .join(' ');
}

function formatChicago(paper: Paper): string {
  const authors = chicagoAuthors(paper.authors);
  const year = `${yearOf(paper)}.`;
  const title = quoteTitle(paper);
  const source = chicagoSource(paper);
  const link = linkOf(paper);
  return authors
    ? [authors, year, title, source, link].filter(Boolean).join(' ')
    : [title, year, source, link].filter(Boolean).join(' ');
}

function formatGBT(paper: Paper, index: number): string {
  const authors = gbtAuthors(paper.authors);
  const link = linkOf(paper);
  const type = paper.journal ? '[J]' : link ? '[EB/OL]' : '[Z]';
  const title = `${titleOf(paper)}${type}.`;
  const year = yearOf(paper);

  let source = '';
  if (paper.journal) {
    source = `${paper.journal}, ${year}`;
    if (paper.volume) source += `, ${paper.volume}`;
    if (paper.issue) source += `(${paper.issue})`;
    if (paper.pages) source += `: ${paper.pages}`;
    source += '.';
  } else if (link) {
    source = `${year}. ${link}.`;
  }

  const doi = paper.doi ? `https://doi.org/${normalizeDoi(paper.doi)}.` : '';
  return `[${index + 1}] ${[
    authors ? withPeriod(authors) : '',
    title,
    source,
    doi,
  ]
    .filter(Boolean)
    .join(' ')}`;
}

function formatIEEE(paper: Paper, index: number): string {
  const authors = ieeeAuthors(paper.authors);
  const title = titleOf(paper).replace(/[.]+$/, '');
  const quoted = `"${title},"`;
  const year = yearOf(paper);
  const link = linkOf(paper);

  if (paper.journal) {
    let source = paper.journal;
    if (paper.volume) source += `, vol. ${paper.volume}`;
    if (paper.issue) source += `, no. ${paper.issue}`;
    if (paper.pages) source += `, pp. ${paper.pages}`;
    source += `, ${year}`;
    if (paper.doi) source += `, doi: ${normalizeDoi(paper.doi)}`;
    else if (link) source += `, ${link}`;
    return `[${index + 1}] ${[authors ? `${authors},` : '', quoted, `${source}.`]
      .filter(Boolean)
      .join(' ')}`;
  }

  return `[${index + 1}] ${[
    authors ? `${authors},` : '',
    quoted,
    `${year}.`,
    link ? `Available: ${link}` : '',
  ]
    .filter(Boolean)
    .join(' ')}`;
}

function escapeBib(value: string): string {
  const slash = '\u0000';
  return value
    .replace(/\\/g, slash)
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(new RegExp(slash, 'g'), '\\textbackslash{}');
}

function bibKey(paper: Paper, index: number, used: Set<string>): string {
  const family = splitName(paper.authors[0] ?? '').family;
  const asciiFamily = family
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z]/g, '');
  const titleWord = (paper.title.match(/[A-Za-z]{3,}/)?.[0] ?? '').toLowerCase();
  const base = asciiFamily
    ? `${asciiFamily}${paper.year ?? ''}${titleWord}`.toLowerCase()
    : `ref${paper.year ?? index + 1}`;
  let key = base;
  let suffix = 1;
  while (used.has(key)) {
    key = `${base}${String.fromCharCode(96 + suffix)}`;
    suffix += 1;
  }
  used.add(key);
  return key;
}

function formatBibTeX(paper: Paper, key: string): string {
  const entry = paper.journal ? 'article' : 'misc';
  const fields: Array<[string, string]> = [];
  const authors = paper.authors.map(bibName).filter(Boolean).join(' and ');
  if (authors) fields.push(['author', escapeBib(authors)]);
  fields.push(['title', escapeBib(titleOf(paper))]);
  if (paper.journal) fields.push(['journal', escapeBib(paper.journal)]);
  if (paper.year) fields.push(['year', String(paper.year)]);
  if (paper.volume) fields.push(['volume', paper.volume]);
  if (paper.issue) fields.push(['number', paper.issue]);
  if (paper.pages) fields.push(['pages', paper.pages.replace(/-/g, '--')]);
  if (paper.doi) fields.push(['doi', normalizeDoi(paper.doi)]);
  if (paper.url) fields.push(['url', paper.url]);

  const width = Math.max(...fields.map(([name]) => name.length), 5);
  return [
    `@${entry}{${key},`,
    ...fields.map(([name, value]) => `  ${name.padEnd(width)} = {${value}},`),
    '}',
  ].join('\n');
}

function splitPages(pages?: string): [string, string] {
  const text = clean(pages);
  if (!text) return ['', ''];
  const parts = text.split(/[–—-]/).map((p) => p.trim());
  return [parts[0] ?? '', parts[1] ?? ''];
}

function formatRIS(paper: Paper): string {
  const link = linkOf(paper);
  const lines = [`TY  - ${paper.journal ? 'JOUR' : link ? 'ELEC' : 'GEN'}`];
  for (const author of paper.authors) {
    const name = risName(author);
    if (name) lines.push(`AU  - ${name}`);
  }
  lines.push(`TI  - ${titleOf(paper)}`);
  if (paper.journal) lines.push(`JO  - ${paper.journal}`);
  if (paper.year) lines.push(`PY  - ${paper.year}`);
  if (paper.volume) lines.push(`VL  - ${paper.volume}`);
  if (paper.issue) lines.push(`IS  - ${paper.issue}`);
  const [startPage, endPage] = splitPages(paper.pages);
  if (startPage) lines.push(`SP  - ${startPage}`);
  if (endPage) lines.push(`EP  - ${endPage}`);
  if (paper.doi) lines.push(`DO  - ${normalizeDoi(paper.doi)}`);
  if (link) lines.push(`UR  - ${link}`);
  lines.push('ER  - ');
  return lines.join('\n');
}

function sortKey(paper: Paper): string {
  const family = splitName(paper.authors[0] ?? '').family;
  return `${family} ${paper.year ?? 9999} ${paper.title}`.toLowerCase();
}

function dedupe(papers: Paper[]): Paper[] {
  const seen = new Set<string>();
  return papers.filter((paper) => {
    const key = paper.doi
      ? `doi:${normalizeDoi(paper.doi).toLowerCase()}`
      : `title:${clean(paper.title).toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 生成整份参考文献表。
 * APA / MLA / Chicago / BibTeX / RIS 按作者字母排序；
 * GB/T 7714 与 IEEE 按当前勾选顺序编号。
 */
export function buildReferenceList(papers: Paper[], style: CitationStyle): string {
  const unique = dedupe(papers);
  if (!unique.length) return '';

  const ordered =
    style === 'gbt7714' || style === 'ieee'
      ? unique
      : [...unique].sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'en'));

  switch (style) {
    case 'apa':
      return ordered.map(formatAPA).join('\n\n');
    case 'mla':
      return ordered.map(formatMLA).join('\n\n');
    case 'chicago':
      return ordered.map(formatChicago).join('\n\n');
    case 'gbt7714':
      return ordered.map(formatGBT).join('\n');
    case 'ieee':
      return ordered.map(formatIEEE).join('\n');
    case 'bibtex': {
      const used = new Set<string>();
      return ordered
        .map((paper, index) => formatBibTeX(paper, bibKey(paper, index, used)))
        .join('\n\n');
    }
    case 'ris':
      return ordered.map(formatRIS).join('\n\n');
    default:
      return '';
  }
}
