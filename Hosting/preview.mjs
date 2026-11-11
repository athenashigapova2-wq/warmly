import { createChatServer } from '../Server/app.js';
const { http } = createChatServer();
const port = Number(process.env.HOSTED_PREVIEW_PORT || 4300);
http.listen(port, '127.0.0.1', () => console.log(`Supabase preview: http://127.0.0.1:${port}`));
