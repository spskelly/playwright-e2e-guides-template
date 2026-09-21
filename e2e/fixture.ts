import { test as guideTest, expect } from './guide/fixture';
import { startExampleServer, type ExampleServer } from './app/server-adapter';

type TestFixtures = {
  appUrl: string;
};

type WorkerFixtures = {
  exampleServer: ExampleServer;
};

export const test = guideTest.extend<TestFixtures, WorkerFixtures>({
  exampleServer: [
    async ({}, use) => {
      const server = await startExampleServer();
      await use(server);
      await server.close();
    },
    { scope: 'worker' },
  ],
  appUrl: async ({ exampleServer }, use) => {
    const response = await fetch(exampleServer.url + '/api/reset', { method: 'POST' });
    if (!response.ok) throw new Error('could not reset synthetic example state');
    await use(exampleServer.url);
  },
});

export { expect };
