# Technical appendix: Restormel Keys — need, technical development, validation and outputs

**Project:** Restormel Keys — a drop-in BYOK (Bring Your Own Key) and multi-provider routing layer for AI-powered applications  
**Applicant:** ALLOTMENT TECHNOLOGY LTD (solo-founder startup)  
**Location:** Torquay, UK  
**Duration:** 6 months  
**Technology Readiness Level (TRL):** TRL 3 — experimental proof of concept  
**Market Readiness Level (MRL):** MRL 2 — identification of potential business opportunities  

---

## 1. Need and opportunity

Individuals and small and medium-sized businesses (SMBs) increasingly depend on third-party AI APIs for product features and internal workflows. That dependence creates **vendor lock-in**: switching providers means rewriting integrations, re-tuning prompts, and accepting different pricing, availability, and policy models. Many teams also need **explicit control** over which models run for which tasks, under what **cost ceilings**, and with what **compliance or operational constraints**—without giving up quality.

**Restormel Keys** addresses this by proposing a **controlled multi-provider AI execution architecture**: a layer that sits in front of multiple providers, uses the customer’s own API keys (BYOK), and **governs model selection and routing** so that execution remains predictable under stated constraints. The target market is **B2C SaaS** at an accessible price point (**£10/month subscription**), aimed at users who care about **portability**, **operational control**, and **reduced lock-in** rather than a single-vendor default.

---

## 2. Innovation (what is new)

The innovation is not “another chat UI” but a **policy- and constraint-aware routing and execution substrate** that can:

- **Dynamically govern** model selection and routing across providers.
- **Preserve quality, policy compliance, and operational control** through explicit rules rather than ad hoc manual switching.
- **Reduce vendor lock-in** by making provider changes a configuration and policy problem, not a full application rewrite.
- **Encode constraints** such as **cost ceilings**, **entitlements** (who may use what), and **availability** (fallback when a provider or model is degraded or unavailable).

At TRL 3, the emphasis is on **demonstrating** these properties on representative tasks in a **controlled demonstrator**, with **measurable comparison** to simpler baselines.

---

## 3. Technical development plan (four workstreams)

The six-month programme is organised into four workstreams. Sequencing assumes **architecture and evaluation design** early, **core logic** in the middle, and **demonstrator plus comparative validation** toward the end, with continuous integration of lessons learned.

### Workstream 1 — Formalise system architecture for controlled multi-provider AI execution

- Define a clear **provider abstraction** (capabilities, authentication via BYOK, error and rate-limit semantics).
- Specify **routing state**: how requests are classified, how routes are selected, and how decisions are recorded for auditability and debugging.
- Specify **policy enforcement** points (before execution, on failure, on retry) and how policies interact with entitlements.
- Define **monitoring and observability** requirements: structured decision metadata, health signals, and minimal PII-safe logging aligned with security-by-design (no raw key material in logs).

### Workstream 2 — Implement core control logic for request routing under explicit constraints

- Implement routing that optimises or satisfies stated objectives under **cost ceilings**, **entitlements**, **availability**, and **task requirements** (e.g. modality, context length, latency sensitivity).
- Implement **deterministic or explainable** decision paths suitable for a PoC (e.g. documented precedence rules, simulation/explain outputs where applicable).
- Implement **failure handling**: bounded retries, degradation paths, and safe fallbacks consistent with policy.

### Workstream 3 — Build demonstrator environment using an existing reference application context

- Integrate the routing layer with a **reference application** (existing internal or open scaffold) that exercises realistic flows (e.g. summarisation, structured extraction, light agentic steps).
- Ensure the demonstrator shows **BYOK** and **multi-provider** behaviour without requiring a full production SaaS stack; focus on **traceable** runs suitable for evaluation.

### Workstream 4 — Define and run comparative evaluation against baselines

- **Baseline A:** fixed single-provider execution (typical “pick one vendor and stay there”).
- **Baseline B:** manual provider choice (user or developer switches provider without systematic policy).
- **Treatment:** Restormel Keys routing under the same tasks and comparable keys/budgets.
- Pre-register success metrics (see Section 4) and document protocol limitations appropriate to TRL 3.

---

## 4. Validation approach

Validation is **benchmark-led** and **task-grounded**, not solely qualitative.

### Method

- Select a **small, representative task suite** aligned with SMB and individual use (e.g. short-form assistance, document summarisation, light tool-using flows if in scope).
- For each task, run repeated trials with controlled inputs (and fixed random seeds where randomness matters) to reduce noise.
- Compare baselines and the Restormel Keys treatment under **matched constraints** (e.g. comparable monthly budget caps expressed as test harness limits).

### Measures

(Indicative; final set fixed during Workstreams 1–2 and documented before main runs.)

- **Execution quality:** task-specific scores (e.g. rubric-based grading, structured output correctness checks, human spot-checks on a stratified subset where appropriate).
- **Cost behaviour:** total inferred cost per task suite, variance across runs, and behaviour under **cost ceilings** (e.g. graceful degradation vs hard failure).
- **Operational control:** rate of policy violations (should be zero in harness), clarity of routing decisions (explain/simulate outputs), and recovery from injected provider faults in test.
- **Availability / resilience:** outcome distribution under simulated degradation (throttling, temporary errors) when fallback routes are permitted by policy.

### Limitations (explicit for TRL 3)

Sample sizes and generalisation claims remain **proportionate to a PoC**; the goal is **credible comparative evidence** and a **repeatable evaluation protocol**, not exhaustive market-wide benchmarking.

**One-line summary for forms:** *Measures: execution quality, cost behaviour under ceilings, policy compliance, and resilience under controlled failure injection.*

---

## 5. Outputs and success criteria (6 months)

### Technical outputs

- Architecture specification for multi-provider execution, routing state, policy enforcement, and monitoring.
- Implementable **core routing and constraint logic** in the PoC scope.
- **Demonstrator** integrated with a reference application context.
- **Evaluation report:** comparative results vs baselines, with methodology, metrics, and limitations.

### Success criteria (PoC-appropriate)

- Demonstrated **multi-provider routing under explicit constraints** on the task suite.
- Measurable **quality–cost–control trade-offs** documented vs baselines.
- Clear **path to TRL 4** (validation in relevant environment) articulated as follow-on work, without over-claiming production scale.

---

## 6. Market alignment (MRL 2)

Within the grant period, market activity focuses on **validating the problem–solution fit narrative** and **pricing hypothesis** (£10/month B2C SaaS) through **structured customer discovery** (interviews, landing-page learning, waitlist or early-access cohort if pursued)—kept distinct from TRL technical claims. Outputs may include a **concise market note** summarising segments, objections, and willingness-to-pay signals; this supports MRL 2 without implying large-scale commercial traction.

---

## 7. Risks and mitigation (summary)

| Risk | Mitigation |
|------|------------|
| Provider API churn and heterogeneity | Strict provider abstraction; versioned adapters; narrow initial provider set for PoC |
| Evaluation noise (quality/cost) | Fixed task suite; repeated trials; documented harness limits |
| Scope creep beyond PoC | Time-box workstreams; defer full production SaaS features |
| Security/privacy (BYOK) | Keys handled as secrets; minimised logging; threat-informed design review |

---

## 8. Team and delivery

**ALLOTMENT TECHNOLOGY LTD** is a **solo-founder** company based in **Torquay**. Delivery is organised around the workstreams above, with **monthly milestones** and explicit **go/no-go** checks before large evaluation runs. External advisors or collaborators may be named in the main application if applicable.

---

## 9. Suggested six-month milestone map (illustrative)

| Month | Focus |
|-------|--------|
| 1–2 | Workstream 1: architecture, policy model, evaluation protocol draft |
| 2–4 | Workstream 2: core routing and constraint logic; early unit/integration tests |
| 4–5 | Workstream 3: demonstrator integration and dry-run tasks |
| 5–6 | Workstream 4: comparative runs, analysis, report; MRL 2 discovery synthesis |

---

*Reference copy for grant applications. Not a legal or commercial commitment.*
