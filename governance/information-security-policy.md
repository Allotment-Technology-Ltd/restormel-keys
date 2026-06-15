---
id: REC-POL-001
title: Information Security Policy
class: governance
owner: founder
status: approved
approved-by: Adam Boon
approved-on: 2026-06-15
classification: internal
control-tier: 2
created: 2026-06-15
last-reviewed: 2026-06-15
review-interval: P12M
retention: P6Y-after-superseded
---

# Information Security Policy

**Allotment Technology Ltd** · Version 2026-06-15 · Effective 15 June 2026

## 1. Purpose

This policy establishes management direction and commitment for information security
across Allotment Technology Ltd / Restormel. It provides the framework for protecting
the confidentiality, integrity, and availability of information assets, and supports
the company's target alignment with ISO 27001.

This policy is approved by the sole director and applies immediately. It is reviewed
at least annually and on material change.

## 2. Scope

The ISMS covers the development, operation, and support of the Restormel product
(Keys, Connect) and its supporting infrastructure: the self-hosted Coolify/Hetzner
compute plane (Helsinki, EU), the restormel-keys and restormel-ops repositories hosted
on Forgejo, and associated SaaS sub-processors listed in the supplier register
(`suppliers.yaml`, REC-GOV-005).

**Explicitly out of scope at this stage:** other Allotment Technology Ltd products
(Plot, Sophia) and their infrastructure. The scope boundary will be reviewed and
expanded when those products reach customer-facing maturity or share in-scope
infrastructure with Restormel.

## 3. Roles and responsibilities

**ISMS owner:** Adam Boon (sole director and founder) is accountable for the ISMS
while the company is solo-led. This includes approving policies, accepting residual
risks, and commissioning the annual management review.

As the team grows, roles will be formally allocated and this policy updated to reflect
them. Until then, all ISMS responsibilities rest with the founder.

## 4. Policy commitments

Allotment Technology Ltd commits to:

**Confidentiality, integrity, and availability.** Information assets are protected
against unauthorised access, modification, and disruption, proportionate to their
classification (confidential / internal / public) as defined in the data inventory
(`data-inventory.yaml`, REC-GOV-007).

**Risk-based management.** Information security risks are identified, assessed, and
treated via the risk register (`risk-register.yaml`, REC-GOV-002). Residual risks are
explicitly accepted by the founder. The risk register is reviewed at least every six
months and on material change.

**Access control on least-privilege principles.** Access to systems and data is the
minimum necessary for the task. Individual accountability is maintained through named
accounts. Credentials are never committed to version control. Details are in the Access
Control Policy (`access-control-policy.md`, REC-POL-002).

**Legal and regulatory compliance.** The company meets its obligations under UK GDPR,
the Companies Act 2006, and applicable ICO guidance. Processing activities are
documented in the Record of Processing Activities (`ropa.yaml`, REC-GOV-003) and
sub-processors are managed via the supplier register.

**Sovereignty posture.** Personal data and the verification path are kept on UK/EU
infrastructure where practicable (self-hosted Coolify/Hetzner, PostHog EU). US-SaaS
connectors are used only for tooling and non-regulated data, or where appropriate
safeguards (SCCs/IDTA) are in place.

**Supplier and sub-processor oversight.** Sub-processors are maintained in the supplier
register with confirmed DPA status. Changes to the sub-processor list are communicated
to customers as required. Sub-processors are reviewed annually.

**Security event recording and monitoring.** Security-relevant events are logged in the
audit_events table (DAT-010, 12 months online / 6 years archived). Errors and
exceptions are monitored via Sentry. The posture is reviewed at each management review.

**Continual improvement.** The ISMS is reviewed at planned intervals via scheduled
Cowork tasks (see `governance/README.md`) and improved based on findings, incidents,
and changes to the business or threat landscape.

## 5. Exceptions

Exceptions to this policy or to any supporting control must be:

1. Approved by the founder in writing (email to `contact@restormel.dev` or a signed
   commit to the governance repo); and
2. Recorded in the risk register (`risk-register.yaml`) with a justification, the
   approving party, and a review date no more than 12 months out.

Undocumented exceptions are not permitted.

## 6. Communication

This policy is available to all team members and relevant interested parties on request.
The published privacy notice (`https://restormel.dev/keys/privacy`) communicates the
relevant data-protection commitments to data subjects.

## 7. Review

This policy is reviewed at least annually (review interval: P12M) and on any material
change to the business, infrastructure, or threat landscape. The next scheduled review
is triggered by the `isms-annual-management-review` Cowork task (15 December 2026).
Supporting controls are tracked in the Statement of Applicability (`soa.md`, REC-GOV-004).
