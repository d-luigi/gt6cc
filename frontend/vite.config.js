// The dev server proxies /api to the Go backend, so no CORS setup is needed.
export default {
  server: { port: 5173, proxy: { '/api': 'http://localhost:8080' } },
};
