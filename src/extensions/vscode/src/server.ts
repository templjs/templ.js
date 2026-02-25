import {
  createConnection,
  createServer,
  createSimpleProjectProvider,
} from '@volar/language-server/node';
import { createTempljsLanguagePlugin } from '@templjs/volar';

const connection = createConnection();
const server = createServer(connection);

const serverOptions = {
  watchFileExtensions: [
    '.templ.md',
    '.templ.json',
    '.templ.yaml',
    '.templ.yml',
    '.templ.html',
    '.tmpl.md',
    '.tmpl.json',
    '.tmpl.yaml',
    '.tmpl.yml',
    '.tmpl.html',
  ],
  getServicePlugins() {
    return [];
  },
  getLanguagePlugins() {
    return [createTempljsLanguagePlugin()];
  },
};

connection.onInitialize((params) =>
  server.initialize(params, createSimpleProjectProvider, serverOptions)
);
connection.onInitialized(server.initialized);
connection.onShutdown(server.shutdown);
connection.listen();
