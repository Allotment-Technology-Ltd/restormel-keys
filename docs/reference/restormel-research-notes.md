# Research notes: documentation, dashboard UX, BYOK management, model catalog, and cost intelligence for an AI gateway / key-management product

## 1. Core framing: what category this product is actually in

The most useful comparison set is not “API key settings pages” in the abstract. It is the emerging class of **AI gateways / control planes** that sit between apps and multiple model providers. The strongest products in this category present a unified entry point for inference, let users connect their own provider credentials, expose model and provider routing, surface usage and spend, and increasingly add observability and lifecycle visibility. Vercel AI Gateway is one of the clearest examples: one endpoint, unified authentication, BYOK support, model browsing, provider routing, fallbacks, and usage/observability in one product surface. OpenRouter is another strong reference because it makes provider routing, BYOK priority, analytics, and model pricing visible in a way that feels native to developers. ([vercel.com](https://vercel.com/docs/ai-gateway?utm_source=chatgpt.com))

A useful conclusion from the current market is that users do not want to separately reason about “dashboard”, “CLI config”, “SDK auth”, “provider credentials”, and “model list” unless they absolutely have to. The products that feel good compress these into one coherent mental model. That is a large part of why Vercel’s approach lands well: the gateway key, unified endpoint, model list, pricing surface, and observability all feel like parts of one system rather than disconnected utilities. ([vercel.com](https://vercel.com/docs/ai-gateway?utm_source=chatgpt.com))

## 2. The biggest UX failure mode in this category

The most damaging failure mode is **credential ambiguity**. Users need to understand the difference between the platform key they use to call the gateway and the provider keys they may optionally connect behind it. Vercel is explicit that every request to AI Gateway requires authentication through API keys or OIDC, and that users can also bring their own provider credentials. OpenRouter is similarly explicit that BYOK keys affect provider routing behavior and are distinct from OpenRouter API keys. When those concepts are blurred, the product feels confusing and risky. ([vercel.com](https://vercel.com/docs/ai-gateway/authentication-and-byok?utm_source=chatgpt.com))

That is directly relevant to your current concern about “I’m not overly clear what this API key is for.” In the best current products, that confusion is designed out up front. The system tells you, in plain language, whether a key is authenticating to the gateway itself, whether it is a management key, or whether it is a stored provider credential. OpenRouter even has a distinct concept of Management API Keys for programmatic key management, which is a helpful precedent if you later need customer-facing key issuance or org automation. ([openrouter.ai](https://openrouter.ai/docs/guides/overview/auth/management-api-keys?utm_source=chatgpt.com))

## 3. What the strongest products do well

### 3.1 Unified access surface

The best products give the user **one stable integration point**. Vercel’s AI Gateway is built around “one endpoint, all your models,” and its model/provider layer exists to let users switch providers or models without rewriting application logic. OpenRouter similarly normalizes its schema across providers to stay close to a common API shape. This is a powerful pattern because it reduces switching cost and makes experimentation easier. ([vercel.com](https://vercel.com/docs/ai-gateway?utm_source=chatgpt.com))

### 3.2 Explicit BYOK flows

BYOK is treated as a first-class product surface, not a hidden advanced setting. Vercel documents a distinct BYOK flow in the dashboard with add, test, enable, and use steps. OpenRouter documents how BYOK changes routing behavior and how it interacts with provider ordering. The common lesson is that BYOK should feel governed and inspectable, not like users are pasting secrets into a generic form. ([vercel.com](https://vercel.com/docs/ai-gateway/authentication-and-byok/byok?utm_source=chatgpt.com))

### 3.3 Routing as a visible concept

A major differentiator in good gateway products is that routing is not magic. OpenRouter exposes provider ordering, allow/deny lists, fallbacks, and special routing behaviors such as quality-first routing for tool use. Vercel similarly documents provider routing and model fallbacks as part of the unified model/provider layer. Users trust the system more when they can understand and influence why a request went where it did. ([openrouter.ai](https://openrouter.ai/docs/guides/routing/provider-selection?utm_source=chatgpt.com))

### 3.4 Real observability, not vanity charts

The stronger pattern is to show usage, spend, model usage, and request-level logs together. Vercel’s observability docs explicitly describe usage and cost graphs plus request summaries and detailed request logs, broken down by project and API key. OpenRouter’s activity reporting similarly emphasizes spend, tokens, and requests, with grouping by model, API key, or creator. This matters because teams need to answer not just “how much are we spending?” but “which project, key, model, or route is driving cost and failures?” ([vercel.com](https://vercel.com/docs/ai-gateway/capabilities/observability?utm_source=chatgpt.com))

## 4. What tends not to work

A dashboard with only “create one project and one API key” is too shallow for the actual complexity of this category. It may work for a toy first-run demo, but it breaks down as soon as a user needs multiple environments, multiple teams, multiple provider credentials, different routing policies, or separate model availability for downstream customers. The reference products have already moved beyond that abstraction. Vercel’s observability and gateway model both assume projects, keys, models, providers, and request logs as separate but connected concepts. OpenRouter’s docs assume organizations, analytics, management keys, provider preferences, and presets. ([vercel.com](https://vercel.com/docs/ai-gateway/capabilities/observability?utm_source=chatgpt.com))

A second thing that does not work is a flat model dropdown without context. Providers now differ on lifecycle, pricing, rate limits, tool support, context windows, prompt caching, and sometimes even the effective characteristics of “the same” model accessed through different surfaces. Vercel explicitly notes that model pricing can vary across providers offering the same model. Anthropic, OpenAI, Google, and Azure all publish lifecycle or retirement information separately. A serious product cannot hide this complexity behind a bare selector. ([vercel.com](https://vercel.com/docs/ai-gateway/pricing?utm_source=chatgpt.com))

A third thing that does not work is static pricing or lifecycle content embedded in prose docs and forgotten. The official provider surfaces change too often. OpenAI pricing explicitly includes different processing tiers and extra tool-related costs in some cases. Anthropic has model lifecycle statuses and migration guidance. Gemini publishes both pricing and deprecation schedules. Azure and Vertex also maintain retirement/lifecycle pages. If your dashboard and docs are not fed from an up-to-date source of truth, users will eventually stop trusting them. ([developers.openai.com](https://developers.openai.com/api/docs/pricing/?utm_source=chatgpt.com))

## 5. Documentation research: what “best in practice” looks like now

### 5.1 Good docs are multi-surface, not just a docs site

The leading developer products now serve documentation in multiple formats at once: conventional docs pages for humans, API reference for direct integration, SDK docs, and increasingly **LLM/MCP-optimized documentation surfaces**. Anthropic explicitly publishes resources for AI ingestion, including a Claude API primer, an overview optimized for LLM ingestion, `llms.txt`, and `llms-full.txt`. OpenAI now hosts a public Docs MCP server for developer documentation and documents how to use MCP servers in developer workflows. This is important for your requirement that the knowledge base work for humans, agents, and MCP users. ([docs.anthropic.com](https://docs.anthropic.com/en/resources/overview?utm_source=chatgpt.com))

### 5.2 Quickstarts and references are both still essential

OpenAI, Anthropic, and Vercel all keep a strong separation between “make your first request quickly” and “here is the full reference model.” OpenAI’s developer quickstart is intentionally direct, while its platform docs then branch into models, pricing, tools, rate limits, and deprecations. Anthropic’s docs similarly lead from quickstart into model choice, SDKs, tools, and lifecycle guidance. This still matters because the best docs reduce time to first success without flattening the complexity that advanced users eventually need. ([developers.openai.com](https://developers.openai.com/api/docs/?utm_source=chatgpt.com))

### 5.3 Documentation needs to be structured enough for agents

Your mention of MCP users is crucial. MCP-compatible and agent-compatible docs are not just shorter docs; they are docs with **stable structure, explicit schemas, reliable examples, and machine-readable discovery**. OpenAI’s Docs MCP is literally a documentation surface designed for agent consumption. Anthropic’s AI-ingestion resources and `llms.txt` reflect the same direction. This suggests that a world-class docs system for Restormel should not stop at Markdown pages; it should expose canonical object definitions, schemas, capability metadata, and probably an MCP or at least agent-readable endpoint for docs and model metadata. ([developers.openai.com](https://developers.openai.com/resources/docs-mcp/?utm_source=chatgpt.com))

### 5.4 The docs should explain operational behavior, not only syntax

The best current docs increasingly document operational concerns such as retries, rate limits, routing, tool support, caching, and lifecycle. OpenAI documents rate limits, cost optimization, realtime cost behavior, deprecations, and tool usage including remote MCP. Anthropic documents choosing a model, prompt caching, tool use, and how to use MCP tools. That is a helpful benchmark: good docs in this space do not stop at endpoint syntax. They help users operate the system safely and economically. ([developers.openai.com](https://developers.openai.com/api/docs/guides/rate-limits/?utm_source=chatgpt.com))

## 6. Research on model catalogs and provider/model selection UX

A world-class model catalog now needs to do more than list names. The strongest reference pattern is a catalog that combines model identity, provider availability, pricing, and routing implications. Vercel’s model list surfaces pricing and provider variations. OpenRouter’s models page and request schema emphasize that models and providers interact through routing preferences. Anthropic’s and Google’s model-overview pages give user-facing guidance on model strengths and intended use cases. ([vercel.com](https://vercel.com/docs/ai-gateway/pricing?utm_source=chatgpt.com))

That last point matters a lot for your idea of including strengths, weaknesses, and recommended use cases. The provider ecosystem already publishes much of this information, but it is fragmented and inconsistent. Anthropic explicitly frames model choice around capability, speed, and cost. Google’s current Vertex model pages describe different Gemini variants in terms of context length, agentic workflows, coding strength, and multimodal performance. The market signal is that users benefit from editorial guidance, but the guidance should be structured and sourced, not vague marketing copy. ([docs.anthropic.com](https://docs.anthropic.com/en/docs/about-claude/models/choosing-a-model?utm_source=chatgpt.com))

## 7. Research on deprecations and lifecycle visibility

You are right to want lifecycle visibility in-product. This is not a nice-to-have anymore.

Anthropic has one of the clearest lifecycle patterns: it documents model deprecations and uses statuses such as active, legacy, deprecated, and retired, with recommended replacements and dates. Google Gemini publishes a deprecations page and also surfaces shutdown warnings directly on model pages. OpenAI maintains deprecation documentation for older models and snapshots. Azure distinguishes between deprecation and retirement and notes that retired model deployments return errors. Vertex AI publishes model lifecycle documentation and migration guidance. ([docs.anthropic.com](https://docs.anthropic.com/?utm_source=chatgpt.com))

The main product insight here is that lifecycle information should appear in at least three places: in the model catalog, in any route or project currently using the model, and in alerts or migration flows. The official provider docs make clear that retirement is an operational risk, not just documentation trivia. Azure explicitly notes that retired deployments return errors. Gemini and OpenAI both publish shutdown timing. That means a serious gateway or key-management dashboard should make lifecycle state operationally visible. ([learn.microsoft.com](https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/model-retirements?utm_source=chatgpt.com))

## 8. Research on pricing, rate limits, and cost transparency

### 8.1 Pricing is now too complex to present as a static table

Provider pricing increasingly includes special cases: processing tiers, cached tokens, tool charges, modality differences, preview-vs-GA behavior, and region-specific variants. OpenAI’s pricing docs mention different service tiers, Batch API savings, and model-specific pricing nuances. Anthropic has prompt caching documentation with operational and retention implications. Gemini and Vertex both maintain separate pricing pages. Vercel’s documentation explicitly tells users to inspect pricing per model and notes that pricing can vary across providers even for the same model. ([developers.openai.com](https://developers.openai.com/api/docs/pricing/?utm_source=chatgpt.com))

### 8.2 Rate limits need first-class treatment

Rate limits are not just a support issue; they affect routing, fallback, budgeting, and user trust. OpenAI has dedicated rate-limit docs and model pages that tie limits to usage tiers. Google’s Gemini docs do the same, and Vertex publishes quotas by region and model. If Restormel is sitting in front of multiple providers, it will need a way to explain both platform-side limits and upstream provider-side limits, and ideally to distinguish between hard failures, throttling, and rerouting. ([developers.openai.com](https://developers.openai.com/api/docs/guides/rate-limits/?utm_source=chatgpt.com))

### 8.3 Cost calculators are increasingly necessary

The research supports your instinct that users need scenario modeling, not just retrospective spend charts. OpenAI’s cost docs already push users to think in terms of token efficiency, batching, and service tiers. OpenRouter’s activity model already distinguishes spend, tokens, and requests, and it includes estimated BYOK spend in reporting. That suggests a strong product pattern: users want both actual observed spend and modeled expected spend for a given workload or route. ([developers.openai.com](https://developers.openai.com/api/docs/guides/cost-optimization/?utm_source=chatgpt.com))

## 9. Research on analytics and observability expectations

The current bar for AI infrastructure dashboards is moving beyond “token count and total spend.” Vercel’s observability surface is explicitly framed as a debugging and monitoring capability, with usage and cost metrics plus request summaries and detailed logs. OpenRouter’s activity view similarly allows filtering and grouping by time, model, API key, and creator. These are signs that users expect dashboards to answer operational questions quickly: what failed, what got slow, what got expensive, and which key or route caused it. ([vercel.com](https://vercel.com/docs/ai-gateway/capabilities/observability?utm_source=chatgpt.com))

There is also a clear opportunity for differentiation here. OpenRouter’s routing and BYOK behavior, plus Vercel’s observability model, suggest that a strong dashboard could show not just spend and failures, but **why a route chose one provider over another**, when it fell back, whether BYOK capacity was used first, and whether a given route would have been cheaper or faster under an alternative policy. That last part is an inference from the available patterns rather than something the docs state directly, but it follows naturally from the current reference products. ([openrouter.ai](https://openrouter.ai/docs/guides/overview/auth/byok?utm_source=chatgpt.com))

## 10. Research on support for CLI users, API users, and agent/MCP users

The market no longer treats these as separate audiences with separate products. Instead, the strongest platforms give different entry points into the same control plane.

For CLI and SDK users, Anthropic’s Agent SDK and Claude Code docs are useful references because they show how an advanced toolchain can still be documented as part of one broader developer journey. OpenAI’s docs similarly bridge APIs, tools, MCP, and developer mode. The lesson is that your CLI, SDK, API, and MCP experiences should share the same canonical nouns, auth model, and docs source of truth. ([docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code/sdk?utm_source=chatgpt.com))

For MCP users specifically, OpenAI now documents both using remote MCP servers and building MCP servers, and Anthropic documents both what MCP is and how Claude Code connects to tools via MCP. This means MCP can no longer be treated as fringe or purely experimental. If Restormel is intended to work for agentic users, its docs and product surfaces should likely account for MCP as a first-class integration pattern, not a bolt-on appendix. ([developers.openai.com](https://developers.openai.com/api/docs/mcp/?utm_source=chatgpt.com))

## 11. A useful set of competitive/product precedents

### Vercel AI Gateway
Best precedent for unified gateway UX: one endpoint, explicit auth and BYOK, model browsing, provider routing, fallbacks, observability, and dashboard-level pricing visibility. This seems especially relevant to the “world class for CLI junkies, API boffins and vibe coders” ambition because Vercel tends to bridge advanced capability with approachable DX. ([vercel.com](https://vercel.com/docs/ai-gateway?utm_source=chatgpt.com))

### OpenRouter
Best precedent for explicit routing, BYOK interactions, model diversity, usage analytics, and programmable management. Especially useful for thinking about how users might curate which providers and models are exposed to their own downstream customers. ([openrouter.ai](https://openrouter.ai/docs/guides/overview/auth/byok?utm_source=chatgpt.com))

### Anthropic docs
Best precedent for documentation optimized for both humans and LLMs, plus clean lifecycle guidance and model-choice framing. Particularly useful if you want the docs knowledge base itself to be agent-friendly. ([docs.anthropic.com](https://docs.anthropic.com/en/resources/overview?utm_source=chatgpt.com))

### OpenAI docs
Best precedent for MCP-aware developer documentation, broad operational guidance, and structured docs spanning quickstarts, tools, models, pricing, limits, and deprecations. Particularly relevant for the “human and agent and MCP users” requirement. ([developers.openai.com](https://developers.openai.com/resources/docs-mcp/?utm_source=chatgpt.com))

### Google / Vertex / Azure
Best precedents for showing that model lifecycle, quotas, pricing, and region/provider variations are ongoing operational facts, not secondary metadata. Important if Restormel wants to be a trustworthy control plane over many providers. ([docs.cloud.google.com](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions?utm_source=chatgpt.com))

## 12. Synthesis: what the research seems to say

The category leaders are converging on a few strong principles.

First, the product needs a clear distinction between **platform auth** and **provider credentials**. Without that, users remain unsure what the product key actually does. Vercel and OpenRouter both handle this explicitly. ([vercel.com](https://vercel.com/docs/ai-gateway/authentication-and-byok?utm_source=chatgpt.com))

Second, model selection now needs to be treated as a **catalog and routing problem**, not a dropdown. Pricing, lifecycle, rate limits, provider differences, and use-case guidance all matter. ([vercel.com](https://vercel.com/docs/ai-gateway/pricing?utm_source=chatgpt.com))

Third, docs need to exist in forms that both humans and agents can consume. Anthropic’s `llms.txt` / LLM-ingestion resources and OpenAI’s Docs MCP are strong signals here. ([docs.anthropic.com](https://docs.anthropic.com/en/resources/overview?utm_source=chatgpt.com))

Fourth, usage analytics need to be operational and explainable, not just decorative. Users want request-level logs, grouped spend, and route/provider visibility. ([vercel.com](https://vercel.com/docs/ai-gateway/capabilities/observability?utm_source=chatgpt.com))

Fifth, lifecycle and pricing data should be maintained as living system data, because providers change them frequently and independently. ([developers.openai.com](https://developers.openai.com/api/docs/pricing/?utm_source=chatgpt.com))

---

# Questions and areas needing answers or further research

## Product-definition questions

1. Is Restormel primarily a **gateway/control plane**, or is it also intended to become a **billing aggregator/reseller** in its own right?
2. Is the current “API key” meant to authenticate:
   - the CLI,
   - the SDK,
   - the API,
   - MCP clients,
   - management operations,
   - or some combination of these?
3. Will users have multiple **workspaces / orgs / teams / projects / environments**, or is the product intentionally flatter?
4. Are users managing models only for their own internal use, or do they need to **curate and expose approved providers/models to their own downstream customers**?
5. Do you want Restormel to provide its own editorial layer on model selection, or only normalize and relay provider guidance?

## Security and credential-model questions

6. What exact credential types will exist in the product?
7. Will there be separate concepts for:
   - gateway keys,
   - management keys,
   - provider keys,
   - user tokens,
   - service accounts,
   - OIDC / workload identity?
8. How should provider credentials be scoped: account-wide, workspace-wide, project-wide, environment-wide, or route-specific?
9. Will users be able to test, rotate, disable, or audit provider credentials from the dashboard?
10. Do you need customer-facing APIs for programmatic key creation and rotation, similar to OpenRouter management keys? ([openrouter.ai](https://openrouter.ai/docs/guides/overview/auth/management-api-keys?utm_source=chatgpt.com))

## Dashboard and information-architecture questions

11. What are the canonical nouns of the system that must appear consistently across CLI, SDK, API, dashboard, and docs?
12. What should the first-run journey optimize for:
   - fastest first request,
   - safest production setup,
   - simplest BYOK setup,
   - or easiest model experimentation?
13. What minimum analytics slices are needed on day one:
   - by project,
   - by key,
   - by route,
   - by model,
   - by provider,
   - by end customer?
14. How much routing control should be exposed in the UI versus left to API/CLI power users?

## Model catalog and lifecycle questions

15. What exact metadata should your normalized model catalog contain?
16. How will you ingest and refresh:
   - pricing,
   - rate limits,
   - context windows,
   - modality support,
   - tool support,
   - lifecycle states,
   - migration guidance?
17. Will lifecycle states be normalized into your own schema or shown provider-native?
18. How much editorial guidance will you attach to each model, and who will own keeping that guidance current?
19. How should the product handle differences when “the same” model appears through multiple providers at different prices or with different operational characteristics? ([vercel.com](https://vercel.com/docs/ai-gateway/pricing?utm_source=chatgpt.com))

## Documentation-system questions

20. What documentation surfaces do you want to support at launch:
   - human docs,
   - API reference,
   - SDK reference,
   - machine-readable schemas,
   - `llms.txt`,
   - docs MCP,
   - embedded in-app help?
21. Will the docs have a single source of truth for concepts and terminology that also feeds the product UI?
22. Do you want the model catalog and provider catalog to be queryable by agents via API or MCP?
23. Do you need a docs architecture that distinguishes between:
   - conceptual docs,
   - operational docs,
   - troubleshooting,
   - migration,
   - reference,
   - agent-optimized docs?
24. Should the knowledge base itself expose lifecycle and pricing data as live structured objects instead of static content? ([developers.openai.com](https://developers.openai.com/resources/docs-mcp/?utm_source=chatgpt.com))

## Costing and analytics questions

25. What cost-estimation modes matter most:
   - simple monthly estimate,
   - route comparison,
   - provider comparison,
   - cached vs uncached,
   - fallback scenarios,
   - multimodal scenarios?
26. Do users need estimated future spend only, or also budget alerts and anomaly detection?
27. How will BYOK spend be represented when actual billing may happen with the upstream provider rather than with Restormel?
28. Will you normalize costs into one internal ledger even when users are billed in different ways upstream? ([openrouter.ai](https://openrouter.ai/docs/guides/guides/activity-export?utm_source=chatgpt.com))

## MCP / agent experience questions

29. Is MCP a first-class product surface, or a secondary developer convenience?
30. Do you want Restormel to expose its own MCP server for:
   - docs,
   - model catalog,
   - key management,
   - analytics,
   - routing configuration?
31. What operations should be safe for agents to perform without human review?
32. Do you want agent-focused docs to be merely readable by agents, or also directly actionable through MCP and management APIs? ([developers.openai.com](https://developers.openai.com/api/docs/mcp/?utm_source=chatgpt.com))

## Further research worth doing next

33. A tighter comparative review of Vercel AI Gateway, OpenRouter, Portkey, and any other serious AI gateway/control-plane products, focused specifically on dashboard IA and credential taxonomy.
34. A provider-metadata research pass to determine how automatable pricing, rate-limit, and lifecycle ingestion really is from official sources.
35. A docs-platform research pass to compare the best ways to publish one knowledge base for humans, agents, and MCP consumers.
36. A governance/security research pass on secret storage, key rotation, audit logging, customer tenancy, and delegated access.
37. A user-journey research pass for three concrete personas:
   - solo dev / vibe coder,
   - platform engineer / API-heavy team,
   - SaaS vendor exposing curated model choices to their own customers.

When you bring the refined Claude version back, I can turn it into a product blueprint and then into implementation prompts.
