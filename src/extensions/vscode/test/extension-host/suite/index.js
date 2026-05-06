/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const path = require('node:path');
const Mocha = require('mocha');

function run() {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 30_000,
  });

  mocha.addFile(path.resolve(__dirname, '..', 'diagnostics.test.js'));

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} extension host test(s) failed.`));
        return;
      }

      resolve();
    });
  });
}

module.exports = {
  run,
};
