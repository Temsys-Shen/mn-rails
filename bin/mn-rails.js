#!/usr/bin/env node

import { main } from "../dist/index.js";

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`mn-rails: ${message}`);
  process.exitCode = 1;
}
