import type { Paper } from '../types';
import { uid } from './utils';

const OPENALEX_ENDPOINT = 'https://api.openalex.org/works';

interface OpenAlexWork {
  id?: string;
  title?: string | null;
  display_name?: string | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  authorships?: Array<{ author?: { display_name?: string | null } | null }> | null;
  publication_year?: number | null;
  doi?: string | null;
  cited_by_count?: number | null;
  primary_location?: { landing_page_url?: string | null } | null;
}

interface OpenAlexResponse {
  results?: OpenAlexWork[];
  error?: string;
  message?: string;
}

/** 把 OpenAlex 的倒排索引还原成摘要文本 */
export function reconstructAbstract(
  inverted: Record<string, number[]> | null | undefined
): string {
  if (!inverted) return '';
  const slots: string[] = [];
  for (const [word, positions] of Object.entries(inverted)) {
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) {
      if (typeof pos === 'number') slots[pos] = word;
    }
  }
  return slots.filter(Boolean).join(' ').trim();
}

function toPaper(work: OpenAlexWork): Paper {
  const authors = (work.authorships ?? [])
    .map((a) => a?.author?.display_name?.trim())
    .filter((name): name is string => Boolean(name));

  const doi = work.doi?.trim();
  const landing = work.primary_location?.landing_page_url?.trim();
  const url = doi || landing || work.id || '';

  return {
    id: work.id || uid('openalex-'),
    title: (work.title || work.display_name || '未命名文献').trim(),
    abstract: reconstructAbstract(work.abstract_inverted_index),
    authors,
    year: typeof work.publication_year === 'number' ? work.publication_year : null,
    url,
    citedByCount: typeof work.cited_by_count === 'number' ? work.cited_by_count : 0,
    manual: false,
  };
}

/**
 * 按被引数从高到低检索文献。
 * 网络 / 接口错误会抛出带中文说明的 Error，由调用方展示降级 UI。
 */
export async function searchWorks(query: string, perPage = 10): Promise<Paper[]> {
  const q = query.trim();
  if (!q) throw new Error('请先输入检索关键词');

  const params = new URLSearchParams({
    search: q,
    'per-page': String(perPage),
    sort: 'cited_by_count:desc',
    select:
      'id,title,display_name,abstract_inverted_index,authorships,publication_year,doi,cited_by_count,primary_location',
  });

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20000);

  let res: Response;
  try {
    res = await fetch(`${OPENALEX_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } catch {
    window.clearTimeout(timer);
    throw new Error('文献服务暂时连不上，请检查网络，或手动录入文献。');
  }
  window.clearTimeout(timer);

  if (!res.ok) {
    throw new Error(`文献服务返回了 ${res.status}，可以稍后重试，或手动录入文献。`);
  }

  let data: OpenAlexResponse;
  try {
    data = (await res.json()) as OpenAlexResponse;
  } catch {
    throw new Error('文献服务返回的内容无法解析，请稍后重试或手动录入。');
  }

  if (data.error) {
    throw new Error(`文献服务报错：${data.message || data.error}`);
  }

  return (data.results ?? []).map(toPaper).filter((p) => Boolean(p.title));
}

export function createManualPaper(input: {
  title: string;
  authors: string;
  year: string;
  abstract: string;
  url: string;
}): Paper {
  return {
    id: uid('manual-'),
    title: input.title.trim(),
    authors: input.authors
      .split(/[,，、;；]/)
      .map((s) => s.trim())
      .filter(Boolean),
    year: input.year.trim() ? Number(input.year) || null : null,
    abstract: input.abstract.trim(),
    url: input.url.trim(),
    citedByCount: 0,
    manual: true,
  };
}
