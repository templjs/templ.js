import { startTempljsLanguageServer } from './server.js';

void Promise.resolve(startTempljsLanguageServer()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
