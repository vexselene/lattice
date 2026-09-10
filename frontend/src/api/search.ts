import { SearchResult, NodeType } from '../types/graph';

import { normalizeError } from './errors';

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
