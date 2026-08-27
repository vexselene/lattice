import axios, { InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

export const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().sessionToken;
  if (token && config.headers) {
    config.headers['session-token'] = token;
  }
  return config;
});
