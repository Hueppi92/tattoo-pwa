# Tattoo App Combined (PWA + MVP Server)

## Structure
- `client/` — static PWA (from tattoo-pwa-main/client)
- `server/` — Node.js API + SQLite (from tattoo-mvp-server-js) with glue in `app.js`

## Quickstart
```bash
cd server
npm i
node app.js
# open http://localhost:3000
```
Uploads are served from `/uploads`. API base is `/api/*` (artist register/login, wannados, ideas, templates, customers).
