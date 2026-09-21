import type { IncomingMessage, ServerResponse } from 'node:http';

export const SYNTHETIC_USER = {
  email: 'alex@example.test',
  password: 'synthetic-password',
  name: 'Alex Example',
} as const;

export type ExampleState = {
  signedIn: boolean;
  tasks: string[];
};

export function createExampleState(): ExampleState {
  return {
    signedIn: false,
    tasks: ['Review the synthetic launch checklist'],
  };
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

export async function handleMockApi(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  state: ExampleState,
): Promise<boolean> {
  if (request.method === 'POST' && url.pathname === '/api/reset') {
    state.signedIn = false;
    state.tasks = ['Review the synthetic launch checklist'];
    json(response, 200, { ok: true });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/session') {
    const body = await readJson(request);
    if (body.email === 'unavailable@example.test') {
      json(response, 503, { error: 'The synthetic service is temporarily unavailable.' });
      return true;
    }
    if (body.email !== SYNTHETIC_USER.email || body.password !== SYNTHETIC_USER.password) {
      json(response, 401, { error: 'Use the documented synthetic credentials.' });
      return true;
    }
    state.signedIn = true;
    json(response, 200, { name: SYNTHETIC_USER.name });
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/tasks') {
    if (!state.signedIn) {
      json(response, 401, { error: 'Sign in first.' });
      return true;
    }
    json(response, 200, { tasks: state.tasks });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/tasks') {
    if (!state.signedIn) {
      json(response, 401, { error: 'Sign in first.' });
      return true;
    }
    const body = await readJson(request);
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      json(response, 400, { error: 'Task title is required.' });
      return true;
    }
    state.tasks.push(title);
    json(response, 201, { title });
    return true;
  }

  return false;
}
