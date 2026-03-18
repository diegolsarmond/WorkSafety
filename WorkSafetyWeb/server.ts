import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import http from 'http';
import { URL } from 'url';

const DJANGO_API_URL = process.env.DJANGO_API_URL || 'http://127.0.0.1:8000';
const djangoUrl = new URL(DJANGO_API_URL);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

  app.use(express.json());

  // Middleware de proxy para rotas da API Django
  app.use('/api', (req, res) => {
    const options = {
      hostname: djangoUrl.hostname,
      port: djangoUrl.port || (djangoUrl.protocol === 'https:' ? 443 : 80),
      path: `/api${req.url}`,
      method: req.method,
      headers: {
        ...req.headers,
        host: djangoUrl.host,
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err);
      res.status(502).json({ 
        error: 'Backend Django não está disponível',
        details: err.message,
        django_url: DJANGO_API_URL
      });
    });

    // Passar o body para a requisição proxy
    if (req.body && Object.keys(req.body).length > 0) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }

    proxyReq.end();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Proxying API requests to ${DJANGO_API_URL}`);
  });
}

startServer();
