<!-- Restormel PR template. Keep it short — the goal is a clean, attributable trail. -->

## What & why

<!-- One or two lines. Link the issue this resolves. -->
Closes #

## Type

- [ ] feature  - [ ] bug  - [ ] task/chore  - [ ] spike  - [ ] docs

## Checklist

- [ ] CI is green (Forgejo Actions)
- [ ] Linked to its issue (`Closes #` above) and the right milestone/labels are set
- [ ] No secrets in the diff
- [ ] **Records:** if this changes a managed fact (asset, sub-processor/connector, data
      flow, capability, decision), the matching `records/` register entry is updated in the
      same change (per `OPERATING-MANUAL.md` self-maintaining-records norm)
- [ ] **Sovereignty:** no regulated/customer data added to a US-SaaS path; pushed to
      Forgejo (`origin`) only, never the GitHub mirror
- [ ] Docs/quickstart updated if behaviour changed
