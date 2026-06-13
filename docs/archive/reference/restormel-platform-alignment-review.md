# Restormel Platform Alignment Review

Purpose: Analyse how the Restormel Keys product fits within the broader
Restormel ecosystem and long‑term platform roadmap.

------------------------------------------------------------------------

## Overview

Restormel is evolving into a family of developer tools for AI systems.

Current components:

Restormel Keys\
Restormel Graph (future)\
SOPHIA reference application

Keys is the **first revenue product and developer entry point**.

------------------------------------------------------------------------

## Platform Structure

The emerging platform structure looks like:

Restormel Platform

Layer 1 --- Developer Infrastructure\
Restormel Keys

Layer 2 --- Reasoning Infrastructure\
Restormel Graph

Layer 3 --- Reference Applications\
SOPHIA

------------------------------------------------------------------------

## Role of Restormel Keys

Keys provides the foundational infrastructure for:

-   provider connectivity
-   key management
-   model routing
-   cost tracking

It introduces developers to the Restormel ecosystem through a
lightweight, installable library.

------------------------------------------------------------------------

## Role of Restormel Graph

Restormel Graph is expected to provide:

-   reasoning graph inspection
-   debugging tools
-   evaluation pipelines
-   decision lineage tracking

Graph builds on the same AI request flows that Keys helps manage.

------------------------------------------------------------------------

## Shared Infrastructure

Several systems should be shared between products.

### Model Registry

The provider/model registry created for Keys can become a platform
asset.

Both products benefit from:

-   model metadata
-   pricing data
-   lifecycle information
-   provider capabilities

------------------------------------------------------------------------

### Provider Integrations

Keys adapters already implement provider integrations.

Graph can reuse these adapters rather than re‑implementing them.

------------------------------------------------------------------------

### Usage Telemetry

Keys usage tracking creates data that Graph can analyse.

Example:

AI request logs\
model usage patterns\
cost distributions

------------------------------------------------------------------------

## Strategic Flow

Typical developer adoption path:

1.  Builder installs Restormel Keys
2.  Builder manages providers and models
3.  Builder gains insight into model usage
4.  Builder needs deeper reasoning debugging
5.  Builder adopts Restormel Graph

This makes Keys the **top‑of‑funnel product**.

------------------------------------------------------------------------

## Why This Architecture Works

### Keys focuses on operational infrastructure

Keys manages:

-   keys
-   models
-   routing
-   cost

### Graph focuses on reasoning infrastructure

Graph manages:

-   reasoning traces
-   evidence graphs
-   debugging tools

The separation prevents scope creep.

------------------------------------------------------------------------

## Strategic Advantages

This structure provides:

Developer adoption via open‑source tooling\
Recurring revenue via cloud services\
Natural upgrade path to Graph\
Platform‑level shared infrastructure

------------------------------------------------------------------------

## Potential Future Platform Assets

Over time several assets could become shared services:

Model registry API\
Provider capability database\
Routing analytics\
Evaluation pipelines

These would support multiple products.

------------------------------------------------------------------------

## Risks

Potential risks include:

Over‑expanding Keys into a gateway product\
Duplicating infrastructure across Keys and Graph\
Confusing developer messaging

These risks can be mitigated by keeping Keys focused on:

BYOK\
routing\
provider management

------------------------------------------------------------------------

## Conclusion

Restormel Keys is well positioned as the **foundation of the Restormel
developer ecosystem**.

It:

-   generates early revenue
-   attracts developers
-   establishes provider integrations
-   builds shared platform assets

Graph and future tools can then expand on this base.

This architecture allows Restormel to grow into a cohesive platform
without overloading the first product.
