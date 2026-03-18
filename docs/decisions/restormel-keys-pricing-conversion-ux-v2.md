# Restormel Keys — Pricing, Conversion, and UX Strategy (v2)

## Core correction

Restormel Keys does NOT provide hosted key storage as a core product feature.

It is a library-first BYOK layer. Users retain control of their keys and storage.

Paid tier monetises:
- enhanced developer tooling
- routing, insights, and controls
- optional managed convenience (not ownership of keys)

---

## 1. Pricing Page Copy

### Hero

Ship BYOK in minutes — not weeks

Restormel Keys gives you production-grade key management, routing, and cost control — without running heavy infrastructure.

Free for development. Upgrade when you're ready to ship.

---

## Pricing Cards

### Free — £0 / month

Best for: experimenting and prototyping

- 1 project  
- Local key handling (in-app / browser / user-controlled storage)  
- Multi-provider routing  
- Key validation  
- Basic dashboard  
- 1,000 API requests / month  

Limitations:
- No advanced usage insights  
- Limited scale  
- Not production-optimised  

CTA: Get started for free

---

### Pro — £10 / month

Best for: shipping real AI products

- Advanced routing controls  
- Usage insights + cost tracking  
- Higher request limits (50k–100k/month)  
- Multi-project support (5–10)  
- Key health + validation feedback  
- Production-grade performance  

CTA: Upgrade to Pro

---

### Anchor

Most developers start on Free and upgrade when they deploy.

---

## 2. Free vs Pro Strategy

Free = build  
Pro = ship

Key distinction is NOT storage — it is:
- scale
- insight
- control
- reliability

---

## 3. Dashboard Upgrade Prompts

### Usage warning

You’ve used 80% of your monthly request limit.  
Upgrade to avoid interruptions.

---

### Usage limit reached

You’ve reached your free usage limit.  
Upgrade to continue running your app.

---

### Locked insights

Unlock detailed usage and cost insights with Pro.

---

### Production readiness

Deploying your app?  
Upgrade for production-grade limits and visibility.

---

### Routing complexity

Using multiple providers?  
Pro gives you better control and monitoring.

---

## 4. Onboarding Flow

Step 1:
Add your first API key

Step 2:
Key validated

Step 3:
Run first request

Step 4:
Show cost + provider

Step 5:
Introduce Pro subtly:
“Upgrade for better visibility and control”

Step 6:
Trigger upgrade when:
- usage increases
- multiple providers used
- preparing to deploy

---

## 5. Cursor Implementation Prompt

You are implementing pricing and conversion UX for Restormel Keys.

IMPORTANT:
- DO NOT implement hosted key storage
- Keys remain user-controlled
- Product is library-first

Implement:

Free:
- 1 project
- 1,000 requests/month
- basic routing

Pro:
- 50k–100k requests/month
- usage insights
- advanced routing

Add:
- usage tracking (Neon)
- enforcement (Zuplo)
- upgrade prompts
- onboarding flow

Ensure:
- no heavy infra
- no proxy architecture
- fast UX
- clear upgrade path

---

## 6. Strategic Summary

Revenue comes from:
- scale usage
- insights
- control

NOT from:
- storing user secrets

---

## Key principle

We help developers use their keys — not take custody of them.
