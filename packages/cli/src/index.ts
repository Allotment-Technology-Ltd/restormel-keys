#!/usr/bin/env node
/**
 * @restormel/keys-cli — init, add keys, list, validate, doctor, estimate.
 */
import { Command } from "commander";
import { registerInit } from "./commands/init.js";
import { registerAdd } from "./commands/add.js";
import { registerList } from "./commands/list.js";
import { registerValidate } from "./commands/validate.js";
import { registerDoctor } from "./commands/doctor.js";
import { registerEstimate } from "./commands/estimate.js";
import { registerSync } from "./commands/sync.js";
import { registerModels } from "./commands/models.js";
import { registerRouting } from "./commands/routing.js";

const program = new Command();
program
  .name("keys")
  .description("Restormel Keys CLI — init, add keys, validate, doctor, cost estimate, models, routing")
  .version("0.1.0");

registerInit(program);
registerAdd(program);
registerList(program);
registerValidate(program);
registerDoctor(program);
registerEstimate(program);
registerSync(program);
registerModels(program);
registerRouting(program);

program.parse();
