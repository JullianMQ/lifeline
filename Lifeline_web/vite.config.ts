import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  console.log("mode:", env.VITE_NODE_ENV)
  
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
          target: env.VITE_NODE_ENV === 'production' 
            ? env.VITE_HOSTED_BETTER_AUTH_URL
            : env.VITE_LOCAL_BETTER_AUTH_URL, 
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
