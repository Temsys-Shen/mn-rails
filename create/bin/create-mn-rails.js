#!/usr/bin/env node

import { main } from "mn-rails";

try {
  await main(["node", "create-mn-rails", "init", ...process.argv.slice(2)]);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`create-mn-rails: ${message}`);
  process.exitCode = 1;
}
