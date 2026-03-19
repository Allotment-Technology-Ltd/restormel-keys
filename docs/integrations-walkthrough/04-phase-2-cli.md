# Phase 2 — CLI

> **Time:** ~10 minutes  
> **Prerequisites:** [Phase 1](03-phase-1-choose-workflow.md) complete; you chose "In my terminal" or want CLI regardless  
> **You'll need:** Terminal, Node 18+, npm or pnpm

This phase installs the Restormel Keys CLI and runs doctor, validate, models list, and routing explain so you can debug and inspect from the terminal.

---

## Step 2.1 — Install the CLI

```bash
npm install -g @restormel/keys-cli
```

Or as a dev dependency in your project:

```bash
pnpm add -D @restormel/keys-cli
```

Then run via `npx keys` or `pnpm exec keys`.

### You'll see

`keys --help` shows: init, add, list, validate, doctor, estimate, sync, models, routing.

---

## Step 2.2 — Run doctor

From your app directory (where `restormel.config.json` lives, or repo root):

```bash
npx keys doctor
```

Doctor checks framework, `@restormel/keys`, and config. Exit 0 means the local setup is valid.

### How to test

`npx keys doctor` exits with code 0.

---

## Step 2.3 — Validate (optional)

If you have provider credentials in the local key store:

```bash
npx keys validate
```

This checks key validity (masked output). Skip if you use gateway-backed provider access only.

---

## Step 2.4 — Models list

List available models across configured providers:

```bash
npx keys models list
```

Filter by provider:

```bash
npx keys models list --provider anthropic
```

### You'll see

A list of providers and their models with pricing hints.

---

## Step 2.5 — Routing explain

Explain how Restormel would route a request for a given model:

```bash
npx keys routing explain gpt-4o
npx keys routing explain claude-3-5-sonnet
```

### You'll see

Steps: which provider was found for the model, cost lookup, resolution result.

---

## Checkpoint

You now have:

- CLI installed (global or dev dependency).
- Doctor passing.
- `keys models list` and `keys routing explain` working for your setup.
- Optional: validate run for local credentials.
