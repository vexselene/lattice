import { SearchResult, NodeType } from '../types/graph';

function normalizeError(err: any): any {
  if (err && typeof err === 'object') {
    if ('error' in err) return err;
    if (typeof err.message === 'string') {
      try {
        const parsed = JSON.parse(err.message);
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          Object.assign(err, parsed);
          return err;
        }
      } catch {}
    }
  }
  return err;
}

export const search = async (q: string, types?: NodeType[]): Promise<SearchResult[]> => {
  try {
    if (window.api?.cmdSearch) {
      const results = await window.api.cmdSearch(q, types as string[]);
      return results as SearchResult[];
    }
    return [];
  } catch (err) {
    throw normalizeError(err);
  }
};

export const generatePassword = async (): Promise<string> => {
  try {
    if (window.api?.cmdGeneratePassword) {
      const res = await window.api.cmdGeneratePassword();
      return res?.password ?? '';
    }
    return '';
  } catch (err) {
    throw normalizeError(err);
  }
};
