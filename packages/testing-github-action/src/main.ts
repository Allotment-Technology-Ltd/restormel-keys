import { runCiFromEnv } from "./run-ci.js";

void runCiFromEnv().then(
  (code) => {
    process.exit(code);
  },
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
