import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {execFileSync} from 'node:child_process';

function buildRevision() {
  const supplied = process.env.CF_PAGES_COMMIT_SHA || process.env.L3V_BUILD_REVISION;
  if (/^[a-f0-9]{40}$/.test(supplied || '')) return supplied;
  try {
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
    return /^[a-f0-9]{40}$/.test(revision) ? revision : 'development';
  } catch { return 'development'; }
}

export default defineConfig({
  define: {__L3V_BUILD_REVISION__: JSON.stringify(buildRevision())},
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
