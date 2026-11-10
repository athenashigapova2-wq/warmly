import { createChatServer } from './app.js';
const { http, io } = createChatServer();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
http.listen(port, host, () => console.log(`Warmly: http://${host}:${port}`));
http.on('error', error => { console.error(error.message); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => io.close());
