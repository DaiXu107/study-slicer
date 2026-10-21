import type { WizardDraft } from '../types';

const DRAFT_KEY = 'study-slicer:draft:v1';

export const EMPTY_DRAFT: WizardDraft = {
  step: 1,
  title: '',
  stage: '',
  keywords: '',
  query: '',
  results: [],
  selectedIds: [],
  directions: [],
  tasks: [],
};

export function loadDraft(): WizardDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WizardDraft>;
    return {
      ...EMPTY_DRAFT,
      ...parsed,
      step: Math.min(4, Math.max(1, Number(parsed.step) || 1)),
      results: Array.isArray(parsed.results) ? parsed.results : [],
      selectedIds: Array.isArray(parsed.selectedIds) ? parsed.selectedIds : [],
      directions: Array.isArray(parsed.directions) ? parsed.directions : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      aiMode:
        parsed.aiMode === 'tasks-only'
          ? 'tasks-only'
          : parsed.aiMode === 'full'
            ? 'full'
            : undefined,
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: WizardDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // 忽略配额问题
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // 忽略
  }
}

export function hasDraftContent(draft: WizardDraft): boolean {
  return Boolean(
    draft.title.trim() ||
      draft.stage ||
      draft.keywords.trim() ||
      draft.results.length ||
      draft.directions.length ||
      draft.tasks.length
  );
}
