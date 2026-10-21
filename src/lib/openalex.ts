import type { Paper } from '../types';
import { normalizeDoi, uid } from './utils';

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
  primary_location?: {
    landing_page_url?: string | null;
    source?: { display_name?: string | null } | null;
  } | null;
  biblio?: {
    volume?: string | null;
    issue?: string | null;
    first_page?: string | null;
    last_page?: string | null;
  } | null;
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

  const doi = normalizeDoi(work.doi ?? '');
  const landing = work.primary_location?.landing_page_url?.trim();
  const url = doi ? `https://doi.org/${doi}` : landing || work.id || '';
  const firstPage = work.biblio?.first_page?.trim();
  const lastPage = work.biblio?.last_page?.trim();

  return {
    id: work.id || uid('openalex-'),
    title: (work.title || work.display_name || '未命名文献').trim(),
    abstract: reconstructAbstract(work.abstract_inverted_index),
    authors,
    year: typeof work.publication_year === 'number' ? work.publication_year : null,
    url,
    citedByCount: typeof work.cited_by_count === 'number' ? work.cited_by_count : 0,
    journal: work.primary_location?.source?.display_name?.trim() || undefined,
    doi: doi || undefined,
    volume: work.biblio?.volume?.trim() || undefined,
    issue: work.biblio?.issue?.trim() || undefined,
    pages: firstPage ? `${firstPage}${lastPage ? `-${lastPage}` : ''}` : lastPage || undefined,
    manual: false,
  };
}

/**
 * 检索文献。
 * 默认按被引数从高到低（课题向导用）；阅读器扩展文献时传 relevance 用相关性排序。
 * 网络 / 接口错误会抛出带中文说明的 Error，由调用方展示降级 UI。
 */
export async function searchWorks(
  query: string,
  perPage = 10,
  options: { sort?: 'cited' | 'relevance' } = {}
): Promise<Paper[]> {
  const q = query.trim();
  if (!q) throw new Error('请先输入检索关键词');

  const params = new URLSearchParams({
    search: q,
    'per-page': String(perPage),
    select:
      'id,title,display_name,abstract_inverted_index,authorships,publication_year,doi,cited_by_count,primary_location,biblio',
  });
  if (options.sort !== 'relevance') {
    params.set('sort', 'cited_by_count:desc');
  }

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
  journal?: string;
  doi?: string;
}): Paper {
  const doi = normalizeDoi(input.doi);
  const url = input.url.trim() || (doi ? `https://doi.org/${doi}` : '');
  return {
    id: uid('manual-'),
    title: input.title.trim(),
    authors: input.authors
      .split(/[,，、;；]/)
      .map((s) => s.trim())
      .filter(Boolean),
    year: input.year.trim() ? Number(input.year) || null : null,
    abstract: input.abstract.trim(),
    url,
    citedByCount: 0,
    journal: input.journal?.trim() || undefined,
    doi: doi || undefined,
    manual: true,
  };
}
