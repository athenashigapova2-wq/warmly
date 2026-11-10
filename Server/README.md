# Server

Express 5 и Socket.IO 4. `app.js` создаёт сервер, `index.js` запускает его.
Общая комната хранит до 100 сообщений в памяти. MongoDB и аккаунты пока не подключены.
`GET /api/health` — состояние сервера. События: join, presence, message:send, message:new.
