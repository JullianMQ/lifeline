import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler']],
        },
      }),
    ],
    server: {
      proxy: {
        '/api': {
          target: mode === 'production' 
            ? env.VITE_HOSTED_BETTER_AUTH_URL || 'http://localhost:3000'
            : env.VITE_LOCAL_BETTER_AUTH_URL || 'http://localhost:3000', 
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
