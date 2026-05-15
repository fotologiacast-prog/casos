import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const readJsonBody = async (req: any) =>
  new Promise<any>((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });

const sendJson = (res: any, status: number, data: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 3000,
      host: '127.0.0.1',
    },
    plugins: [
      react(),
      {
        name: 'local-monday-playground-api',
        configureServer(server) {
          server.middlewares.use('/api/monday-playground', async (req, res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');

            if (req.method === 'OPTIONS') {
              res.statusCode = 200;
              res.end();
              return;
            }

            if (req.method !== 'POST') {
              sendJson(res, 405, { error: 'Metodo nao permitido.' });
              return;
            }

            const configuredPassword = env.ADMIN_PASSWORD;
            const mondayToken = env.MONDAY_TOKEN;

            if (!configuredPassword || req.headers['x-admin-password'] !== configuredPassword) {
              sendJson(res, 401, { error: 'Senha admin invalida.' });
              return;
            }

            if (!mondayToken) {
              sendJson(res, 500, { error: 'MONDAY_TOKEN ausente no .env.local.' });
              return;
            }

            try {
              const body = await readJsonBody(req);
              const query = String(body?.query || '').trim();
              const variables = body?.variables && typeof body.variables === 'object' ? body.variables : {};

              if (!query) {
                sendJson(res, 400, { error: 'Query GraphQL ausente.' });
                return;
              }

              const mondayResponse = await fetch('https://api.monday.com/v2', {
                method: 'POST',
                headers: {
                  Authorization: mondayToken.trim(),
                  'Content-Type': 'application/json',
                  'API-Version': '2024-10',
                },
                body: JSON.stringify({ query, variables }),
              });
              const data = await mondayResponse.json().catch(() => ({}));
              sendJson(res, mondayResponse.status, data);
            } catch (error) {
              sendJson(res, 500, {
                error: 'Falha ao consultar Monday.',
                details: error instanceof Error ? error.message : String(error),
              });
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
