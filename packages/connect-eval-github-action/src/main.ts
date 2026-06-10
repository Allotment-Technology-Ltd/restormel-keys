import { runGateFromEnv } from "./run-gate.js";

void runGateFromEnv().then(
  (code) => {
    process.exit(code);
  },
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
