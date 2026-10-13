import { readFileSync } from 'node:fs';

/** One version source for package, MCP initialization and request identification. */
export const PACKAGE_VERSION: string = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
