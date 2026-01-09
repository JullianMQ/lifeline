export const API_BASE_URL = import.meta.env.VITE_NODE_ENV === 'production' 
  ? import.meta.env.VITE_HOSTED_BETTER_AUTH_URL 
  : import.meta.env.VITE_LOCAL_BETTER_AUTH_URL;
