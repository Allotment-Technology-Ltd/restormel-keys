# Verification rule sets

Restormel scores the **reasoning quality** of every extracted claim — not whether it is factually
true, but whether it is well-argued. This document explains the scoring model, the built-in
**Restormel Core v1** rule set, and how to override it per domain.

If you have never used Restormel before, start here: a verification rule set is just an explicit,
versioned description of *how claims are judged*. It used to be hard-coded; now it is config you can
inspect (`GET /connect/v1/verification-rules`, `keys rules show`) and override.

## The six dimensions

Each claim's argument is scored from **0.0 to 1.0** on six dimensions. Scores are calibrated
conservatively: `0.5` is average reasoning, `0.8+` is strong, `<0.3` is a major failure.

| Dimension | Weight | What it checks |
|---|---|---|
| `logical_structure` | **0.25** | Does the conclusion follow from the premises? Are the inferences valid and free of fallacies? |
| `evidence_grounding` | **0.20** | Are claims backed by cited evidence rather than bare assertion? |
| `counterargument_coverage` | **0.20** | Does it engage the strongest opposing positions, not strawmen? |
| `scope_calibration` | **0.15** | Are claims scoped to what the evidence supports, not over-generalised? |
| `assumption_transparency` | **0.10** | Are load-bearing assumptions stated rather than hidden? |
| `internal_consistency` | **0.10** | Are the claims mutually consistent, with no self-contradiction? |

### Why these weights

- **Logical structure (0.25)** carries the most weight because validity is the backbone of
  reasoning quality — a structurally invalid argument fails regardless of its other merits.
- **Evidence grounding (0.20)** and **counterargument coverage (0.20)** are the two strongest
  predictors of a claim surviving external scrutiny, so they share the second-highest weight.
- **Scope calibration (0.15)** catches over-claiming — the most common reasoning defect — without
  letting it dominate otherwise-sound arguments.
- **Assumption transparency (0.10)** and **internal consistency (0.10)** are hygiene checks: important,
  but more binary and less discriminating, so they carry the lowest weight.

The six weights **sum to 1.0**. This is enforced in tests.

## The scoring formula

```
overall_score = Σ (dimension_score × dimension_weight)      // 0.0 – 1.0
```

The `overall_score` is then classified by the active **policy**.

## Policies: strict · balanced · lenient

A policy turns the continuous `overall_score` into a verdict:

```
overall_score ≥ min_overall_score        → supported
weak_threshold ≤ overall_score < min      → weak
overall_score < weak_threshold            → unsupported
```

| Policy | `min_overall_score` | `weak_threshold` | When to use |
|---|---|---|---|
| `strict` | 0.75 | 0.60 | Regulated / high-stakes use cases where a false "supported" is costly. |
| `balanced` | 0.60 | 0.45 | The default — mirrors production behaviour. |
| `lenient` | 0.45 | 0.30 | Exploratory ingestion of lower-quality sources, where recall matters more than precision. |

## Overriding rules in a domain pack

A domain pack may carry an optional `verification_rules` field. The pipeline resolves the effective
rule set in this order:

1. **Inline overrides** — adjust individual dimension weights; the resolver renormalises them to sum
   to 1.0:
   ```jsonc
   { "verification_rules": { "type": "inline_overrides",
     "dimension_overrides": { "evidence_grounding": 0.35 } } }
   ```
2. **Referenced rule set** — point at a known rule set by id:
   ```jsonc
   { "verification_rules": { "type": "rule_set_ref", "rule_set_id": "restormel-core-v1" } }
   ```
3. **Built-in core** — when no override is present, **Restormel Core v1** applies.

## Inspecting the active rules

```bash
keys rules show              # the active rule set for your workspace
keys rules list              # built-in + active rule sets
```

```
GET /connect/v1/verification-rules            # active for the workspace
GET /connect/v1/verification-rules/built-in   # the built-in core definition
```

## Contracts

Schemas live in `@restormel/contracts/verification-rules` (`VerificationRuleSet`,
`VerificationDimension`, `VerificationRulePolicy`, `DomainPackVerificationRules`). The built-in set
and the resolver (`resolveVerificationRuleSet`, `classifyByPolicy`, `selectPolicy`) are exported from
`@restormel/graphrag-core`. This rule set is the foundation for the community rule-set registry
(Phase 4).
