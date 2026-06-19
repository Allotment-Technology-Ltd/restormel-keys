---
name: restormel-email-copywriting
description: >-
  Email content & marketing copywriting for Restormel — subject lines, preheaders, body copy, and CTAs that
  are clear, on-brand, accessible, deliverability-safe, and conversion-oriented (more recipients take the
  intended action). Covers transactional vs marketing copy, UK PECR/GDPR compliance wording, and spam-trigger
  avoidance. Use when writing or improving any Restormel email's words. Pairs with restormel-email-design +
  restormel-email-engineering and the generic skills/content-writing.
---

# Restormel email copywriting

Make every Restormel email earn its send: one clear purpose, one obvious next action, in the brand
voice, compliant, and unlikely to land in spam. Builds on the house voice in `skills/content-writing`;
this skill is the email-specific layer. Plan + consent model: REC-PLAN-017.

## Brand voice (apply to all email)
Confident, plain, technically credible. **No hype, no fake urgency, no exclamation spam.** Short
sentences. Lead with the outcome for the reader, not the feature. Write like a competent engineer
telling a peer good news — warm but not saccharine. (Mirror the product's existing voice; don't invent
a louder one for email.)

## Structure: one email, one job
- **Inverted pyramid:** the most important line first. State what happened / what to do before the detail.
- **One primary CTA.** Secondary links are fine but visually + verbally subordinate. Never two competing asks.
- Scannable: a headline that states the outcome, 1–3 short paragraphs, the CTA, a plain fallback link.

## Subject line
- 30–50 chars, front-load the meaning (mobile truncates ~40). Clear > clever.
- Say what's inside / what changed. No clickbait, no ALL CAPS, no `!!!`, no "FREE", "ACT NOW", "$$$"
  (spam triggers, hurts deliverability). Avoid emoji in transactional; use sparingly (≤1) in marketing.
- Transactional: descriptive and reassuring ("Your Restormel Keys access is approved").

## Preheader (the hidden preview line)
- It shows next to the subject in the inbox — **complement** it, don't repeat it. ~40–90 chars.
- Give the reader a reason to open / the next step. (Set it on `EmailShell`'s `preheader` prop.)

## CTA copy
- Verb + specific outcome: **"Open your dashboard"**, not "Click here" / "Submit". Descriptive link text
  also serves screen-reader users (accessibility).
- Set expectations for what happens after the click. Keep one primary CTA per email.

## Transactional vs marketing (keep them distinct)
- **Transactional** (auth, access grants, receipts, security): factual, no marketing, **no unsubscribe**,
  `From notify@`. Don't cross-sell here — it risks compliance + deliverability.
- **Marketing** (newsletter, release notes, updates): value-first, sent only to opted-in recipients,
  **must** carry a working one-click unsubscribe, the sender identity, the physical address, and a clear
  reason-you're-receiving-this line (UK PECR reg. 22 / GDPR). `From news@`/marketing identity.

## Conversion principles (honest persuasion)
- Clarity beats cleverness. Reduce friction: one decision, obvious button, no jargon walls.
- Concrete > vague ("full access to keys, routing, and Connect" beats "lots of features").
- Social proof / urgency **only when true.** No manufactured scarcity.
- Reinforce trust: real sender, real reply-to (`contact@`), plain-text fallback, no dark patterns.

## Deliverability-safe writing
- Balance text-to-image; never an all-image email (also an a11y failure). Avoid spam-trigger vocabulary,
  excessive caps/punctuation, link shorteners, and mismatched/hidden links.
- Always provide the plain-text equivalent (engineering handles the part; write it to read well on its own).

## Accessibility of content
- Descriptive links, plain language (aim ~Grade 8–9 reading level), meaningful image `alt` text written
  here, logical heading/CTA order. See [[restormel-email-engineering]] for the technical a11y checks and
  [[restormel-email-design]] for visual contrast.
