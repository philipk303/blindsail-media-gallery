import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { google } from 'googleapis';
import { REPO_ROOT } from './lib/config.mjs';

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];
const CLIENT_FILE = path.join(REPO_ROOT, 'secrets', 'youtube-oauth-client.json');
const TOKEN_FILE = path.join(REPO_ROOT, 'secrets', 'youtube-token.json');
const REDIRECT = 'http://localhost:5544/oauth2callback';

function loadClient() {
  const raw = JSON.parse(readFileSync(CLIENT_FILE, 'utf8'));
  const c = raw.installed || raw.web;
  return new google.auth.OAuth2(c.client_id, c.client_secret, REDIRECT);
}

async function main() {
  const oauth2 = loadClient();
  const url = oauth2.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });
  console.log('\nOpen this URL in a browser signed in as philipk303@gmail.com:\n');
  console.log(url + '\n');

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, REDIRECT);
      if (u.pathname !== '/oauth2callback') { res.end(); return; }
      const c = u.searchParams.get('code');
      res.end('Authorization received. You can close this tab and return to the terminal.');
      server.close();
      c ? resolve(c) : reject(new Error('no code in callback'));
    }).listen(5544);
  });

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('No refresh_token returned. Revoke the app at myaccount.google.com/permissions and re-run (prompt=consent).');
  }
  writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
  console.log(`Saved refresh token to ${TOKEN_FILE}`);
}

main().catch(err => { console.error(err); process.exit(1); });
