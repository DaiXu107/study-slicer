import type { Paper } from '../types';
import { normalizeDoi, uid } from './utils';

interface ImportedFields {
  title: string;
  authors: string[];
  year: number | null;
  journal?: string;
  doi?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  abstract?: string;
  url?: string;
}

function toPaper(fields: ImportedFields): Paper {
  const doi = normalizeDoi(fields.doi);
  const url = fields.url?.trim() || (doi ? `https://doi.org/${doi}` : '');
  return {
    id: uid('import-'),
    title: fields.title.trim(),
    abstract: fields.abstract?.trim() || '',
    authors: fields.authors.map((a) => a.trim()).filter(Boolean),
    year: fields.year,
    url,
    citedByCount: 0,
    journal: fields.journal?.trim() || undefined,
    doi: doi || undefined,
    volume: fields.volume?.trim() || undefined,
    issue: fields.issue?.trim() || undefined,
    pages: fields.pages?.trim() || undefined,
    manual: true,
    selected: false,
  };
}

function cleanBibValue(value: string): string {
  return value
    .replace(/[{}]/g, '')
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\_/g, '_')
    .replace(/\\textasciitilde\{\}/g, '~')
    .replace(/\s+/g, ' ')
    .trim();
}

function readBracedValue(text: string, start: number, open: string, close: string): [string, number] {
  let depth = 1;
  let index = start + 1;
  let inQuote = false;
  while (index < text.length && depth > 0) {
    const char = text[index];
    if (char === '"' && text[index - 1] !== '\\') inQuote = !inQuote;
    if (!inQuote) {
      if (char === open) depth += 1;
      else if (char === close) depth -= 1;
    }
    index += 1;
  }
  return [text.slice(start + 1, Math.max(start + 1, index - 1)), index];
}

function splitBibEntries(text: string): string[] {
  const entries: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const at = text.indexOf('@', cursor);
    if (at < 0) break;
    let index = at + 1;
    while (index < text.length && /[A-Za-z]/.test(text[index])) index += 1;
    while (index < text.length && /\s/.test(text[index])) index += 1;
    const open = text[index];
    if (open !== '{' && open !== '(') {
      cursor = index + 1;
      continue;
    }
    const close = open === '{' ? '}' : ')';
    const [body, end] = readBracedValue(text, index, open, close);
    const type = text.slice(at + 1, index).trim().toLowerCase();
    entries.push(`@${type}\n${body}`);
    cursor = end;
  }
  return entries;
}

function parseBibFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let index = 0;
  // 跳过 entry key（到第一个逗号）
  while (index < body.length && body[index] !== ',') index += 1;
  index += 1;

  while (index < body.length) {
    while (index < body.length && /[\s,]/.test(body[index])) index += 1;
    const nameStart = index;
    while (index < body.length && /[A-Za-z0-9_-]/.test(body[index])) index += 1;
    const name = body.slice(nameStart, index).toLowerCase();
    while (index < body.length && /\s/.test(body[index])) index += 1;
    if (!name || body[index] !== '=') {
      // 跳过无法识别的片段
      const nextComma = body.indexOf(',', index);
      if (nextComma < 0) break;
      index = nextComma + 1;
      continue;
    }
    index += 1;
    while (index < body.length && /\s/.test(body[index])) index += 1;

    let value = '';
    if (body[index] === '{') {
      const [inner, next] = readBracedValue(body, index, '{', '}');
      value = inner;
      index = next;
    } else if (body[index] === '"') {
      const start = index + 1;
      index += 1;
      while (index < body.length) {
        if (body[index] === '"' && body[index - 1] !== '\\') break;
        index += 1;
      }
      value = body.slice(start, index);
      index += 1;
    } else {
      const start = index;
      while (index < body.length && body[index] !== ',') index += 1;
      value = body.slice(start, index);
    }

    if (name) fields[name] = cleanBibValue(value);
    const nextComma = body.indexOf(',', index);
    if (nextComma < 0) break;
    index = nextComma + 1;
  }
  return fields;
}

/** 解析 BibTeX。只处理有 title 的常规条目，忽略注释和宏。 */
export function parseBibTeX(text: string): Paper[] {
  const papers: Paper[] = [];
  for (const entry of splitBibEntries(text)) {
    if (!entry.startsWith('@')) continue;
    const newline = entry.indexOf('\n');
    if (newline < 0) continue;
    const type = entry.slice(1, newline).trim();
    if (!type || type === 'comment' || type === 'string' || type === 'preamble') {
      continue;
    }
    const fields = parseBibFields(entry.slice(newline + 1));
    const title = fields.title || fields.booktitle || '';
    if (!title) continue;

    const yearMatch = (fields.year || fields.date || '').match(/\d{4}/);
    const year = yearMatch ? Number(yearMatch[0]) : null;
    const authors = (fields.author || '')
      .split(/\s+and\s+/i)
      .map((author) => cleanBibValue(author))
      .filter(Boolean);
    const pages = fields.pages
      ? fields.pages.replace(/--+/g, '-').replace(/\s+/g, '')
      : undefined;

    papers.push(
      toPaper({
        title,
        authors,
        year,
        journal: fields.journal || fields.booktitle,
        doi: fields.doi,
        volume: fields.volume,
        issue: fields.number || fields.issue,
        pages,
        abstract: fields.abstract,
        url: fields.url,
      })
    );
  }
  return papers;
}

/** 解析 RIS。支持多个 TY...ER 条目。 */
export function parseRIS(text: string): Paper[] {
  const papers: Paper[] = [];
  let current: Record<string, string[]> | null = null;

  const push = () => {
    if (!current) return;
    const first = (tag: string) => current?.[tag]?.[0]?.trim() || '';
    const all = (tags: string[]) => {
      for (const tag of tags) {
        const values = current?.[tag];
        if (values?.length) return values;
      }
      return [] as string[];
    };

    const title = first('TI') || first('T1');
    if (title) {
      const yearMatch = (first('PY') || first('Y1')).match(/\d{4}/);
      const startPage = first('SP');
      const endPage = first('EP');
      papers.push(
        toPaper({
          title,
          authors: all(['AU', 'A1']),
          year: yearMatch ? Number(yearMatch[0]) : null,
          journal: first('JO') || first('JF') || first('T2'),
          doi: first('DO'),
          volume: first('VL'),
          issue: first('IS'),
          pages:
            startPage && endPage
              ? `${startPage}-${endPage}`
              : startPage || endPage || undefined,
          abstract: first('AB') || first('N2'),
          url: first('UR'),
        })
      );
    }
    current = null;
  };

  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9])\s{1,3}-\s?(.*)$/.exec(line);
    if (!match) continue;
    const [, tag, value] = match;
    if (tag === 'TY') {
      push();
      current = {};
      continue;
    }
    if (tag === 'ER') {
      push();
      continue;
    }
    if (!current) continue;
    if (!current[tag]) current[tag] = [];
    current[tag].push(value.trim());
  }
  push();

  return papers;
}

export function parseBibliography(text: string): Paper[] {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('文件是空的。');
  if (/^\s*@/m.test(trimmed)) return parseBibTeX(trimmed);
  if (/^TY\s{1,3}-/m.test(trimmed)) return parseRIS(trimmed);
  throw new Error('无法识别格式。请上传 BibTeX（.bib）或 RIS（.ris）文件。');
}
