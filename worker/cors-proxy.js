const NOTION_API = 'https://api.notion.com/v1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Notion-Version',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/notion(\/.*)?$/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Not found — use /notion/...' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const notionPath = match[1] || '/';
    const notionUrl = `${NOTION_API}${notionPath}${url.search}`;

    const init = {
      method: request.method,
      headers: new Headers(request.headers),
    };
    if (!['GET', 'HEAD'].includes(request.method)) {
      init.body = request.body;
    }

    try {
      const response = await fetch(new Request(notionUrl, init));
      const body = await response.arrayBuffer();
      const headers = new Headers(response.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
      return new Response(body, { status: response.status, headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  },
};
