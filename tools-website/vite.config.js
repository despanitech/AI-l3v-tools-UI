import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), {
    name: 'local-editor-status',
    configureServer(server) {
      server.middlewares.use('/api/logo-status', async (_req, res) => {
        let available = false;
        try { available = (await fetch('http://127.0.0.1:4184/', {method: 'HEAD', signal: AbortSignal.timeout(2000)})).ok; } catch {}
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({available}));
      });
    },
  }],
  server: {strictPort: true},
});
