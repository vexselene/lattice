import { invoke } from '@tauri-apps/api/core';
import { SearchResult, NodeType } from '../types/graph';

export const search = async (q: string, types?: NodeType[]): Promise<SearchResult[]> => {
  return await invoke<SearchResult[]>('cmd_search', { query: q, types });
};

export const generatePassword = async (): Promise<string> => {
  const res = await invoke<{ password: string }>('cmd_generate_password');
  return res.password;
};
