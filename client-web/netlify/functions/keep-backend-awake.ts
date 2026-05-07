export default async () => {
  const baseUrl = process.env.BACKEND_KEEPALIVE_URL || process.env.VITE_API_BASE_URL;

  if (!baseUrl) {
    return new Response('BACKEND_KEEPALIVE_URL not configured', { status: 204 });
  }

  const url = `${baseUrl.replace(/\/$/, '')}/health`;
  const response = await fetch(url, {
    headers: {
      'user-agent': 'financial-api-netlify-keepalive',
    },
  });

  return new Response(`keepalive ${response.status}`, { status: 200 });
};
