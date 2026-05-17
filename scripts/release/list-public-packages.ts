import { getPublicPackageManifests } from './lib.ts';

type OutputFormat = 'name' | 'name-version';

function readFormat(): OutputFormat {
  const argument = process.argv.find((value) => value.startsWith('--format='));
  const format = argument?.slice('--format='.length) ?? 'name';

  if (format === 'name' || format === 'name-version') {
    return format;
  }

  throw new Error(`Unsupported --format value: ${format}`);
}

function main(): void {
  const format = readFormat();

  for (const manifest of getPublicPackageManifests()) {
    if (format === 'name-version') {
      console.log(`${manifest.name} ${manifest.version}`);
    } else {
      console.log(manifest.name);
    }
  }
}

main();
