import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    maxWorkers: 1,  // run one test file at a time — prevents concurrent TRUNCATE races on the shared test DB
    // These are set before any module is loaded in the worker, so config.ts
    // and connection.ts see the test DB before dotenv can override them.
    env: {
      DATABASE_URL: 'postgresql://taxibot:taxibot_dev_password@localhost:5432/taxi_bot_test',
      BOT_TOKEN: 'test:FAKE_TOKEN_FOR_MSW',
      ADMIN_IDS: '999',
      SEARCH_RADIUS_KM: '10',
      MAX_RESULTS: '10',
      LOCATION_EXPIRY_HOURS: '1',
    },
    globalSetup: './src/tests/setup/globalSetup.ts',
    setupFiles: ['./src/tests/setup/perTestSetup.ts'],
    include: ['src/tests/**/*.test.ts'],
    testTimeout: 15000,
  },
});
