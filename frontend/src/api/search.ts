import { apiClient } from './client';
import { SearchResult, NodeType } from '../types/graph';

export const search = async (q: string, types?: NodeType[]) => {
  const { data } = await apiClient.get('/search', { params: { q, 'types[]': types } });
  return data.results as SearchResult[];
};

export const generatePassword = async () => {
  const { data } = await apiClient.post('/utils/generate-password');
  return data.password as string;
};
