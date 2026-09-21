import { createServer, type ServerResponse } from 'node:http';
import { createExampleState, handleMockApi } from './mock-api';

export type ExampleServer = {
  url: string;
  close: () => Promise<void>;
};

const styles = [
  'body{font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:48px 24px;background:#f8fafc;color:#172033}',
  'main{background:white;border:1px solid #dbe3ee;border-radius:18px;padding:32px;box-shadow:0 18px 50px rgba(15,23,42,.08)}',
  'label{display:block;margin:16px 0 6px;font-weight:700}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #94a3b8;border-radius:8px}',
  'button,a.button{display:inline-block;margin-top:18px;padding:11px 16px;border:0;border-radius:8px;background:#1d4ed8;color:white;text-decoration:none;font-weight:700}',
  '[role=alert]{margin-top:16px;color:#b42318}li{margin:10px 0}.eyebrow{color:#b45309;font-weight:800;text-transform:uppercase;letter-spacing:.08em}',
].join('');

function page(title: string, body: string, script = ''): string {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    title + ' | Example Workspace</title><style>' + styles + '</style></head><body><main>' + body + '</main>' +
    (script ? '<script>' + script + '</script>' : '') + '</body></html>';
}

function html(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self' 'unsafe-inline'; connect-src 'self'",
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function loginPage(): string {
  const body = '<p class="eyebrow">Synthetic example</p><h1>Sign in</h1><p>Use alex@example.test and synthetic-password.</p>' +
    '<form><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username">' +
    '<label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password">' +
    '<button type="submit">Sign in</button><p role="alert" hidden></p></form>';
  const script = "document.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();const alert=document.querySelector('[role=alert]');alert.hidden=true;const response=await fetch('/api/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:email.value,password:password.value})});const data=await response.json();if(!response.ok){alert.textContent=data.error;alert.hidden=false;return}location.href='/dashboard?view=tasks&session=synthetic-private-value'})";
  return page('Sign in', body, script);
}

function dashboardPage(): string {
  const body = '<p class="eyebrow">Synthetic example</p><h1>Project tasks</h1><p id="status">Loading synthetic tasks...</p><ul aria-label="Tasks"></ul>' +
    '<form><label for="task">New task</label><input id="task" name="task"><button type="submit">Add task</button><p role="alert" hidden></p></form>';
  const script = "const list=document.querySelector('ul');const status=document.querySelector('#status');async function load(){const response=await fetch('/api/tasks');const data=await response.json();if(!response.ok){location.href='/login';return}status.textContent='Signed in as Alex Example';list.replaceChildren(...data.tasks.map(title=>{const item=document.createElement('li');item.textContent=title;return item}))}document.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();const response=await fetch('/api/tasks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:task.value})});const data=await response.json();if(!response.ok){const alert=document.querySelector('[role=alert]');alert.textContent=data.error;alert.hidden=false;return}task.value='';await load()});load()";
  return page('Project tasks', body, script);
}

export async function startExampleServer(): Promise<ExampleServer> {
  const state = createExampleState();
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (await handleMockApi(request, response, url, state)) return;
      if (request.method === 'GET' && url.pathname === '/') {
        html(response, 200, page('Home', '<p class="eyebrow">Synthetic example</p><h1>Example Workspace</h1><p>A deterministic application for adapting this Playwright template.</p><a class="button" href="/login">Open sign in</a>'));
        return;
      }
      if (request.method === 'GET' && url.pathname === '/login') {
        html(response, 200, loginPage());
        return;
      }
      if (request.method === 'GET' && url.pathname === '/dashboard') {
        html(response, 200, dashboardPage());
        return;
      }
      html(response, 404, page('Not found', '<h1>Not found</h1>'));
    } catch {
      html(response, 500, page('Error', '<h1>Unexpected synthetic server error</h1>'));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('example server did not bind to a TCP port');
  return {
    url: 'http://127.0.0.1:' + address.port,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}
