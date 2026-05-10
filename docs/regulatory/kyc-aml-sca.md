# KYC + AML + SCA design (S-303 / S-304 / S-305)

## KYC vendor (S-303)

**Shortlist:** Onfido · Sumsub · Veriff · Persona

**Sandbox decision:** Try **Sumsub** first — best EU coverage, strong
biometric liveness, transparent pricing per verified user. Fallback to
**Onfido** if SI/HR document templates are weaker than expected.

Sandbox setup checklist:
- [ ] Account created on Sumsub dashboard
- [ ] Test ID flow: SI passport, US driver's license, HR ID card
- [ ] Webhook URL pointed at staging `/api/webhooks/sumsub`
- [ ] Sample applicant record stored with consent + retention notes

## AML / sanctions (S-304)

Screen every wallet open against:
- **OFAC SDN** (US Treasury)
- **EU consolidated sanctions list**
- **UN sanctions list**
- (Optional) **HMT (UK)** if we open to UK consumers

Implementation: Sumsub bundles AML monitoring; pricing is +€0.40/applicant.
Our own check stops at name + DOB + nationality. Hits go to a manual
review queue (S-303 admin tooling).

False-positive resolution: 24h SLA. We document each cleared hit with the
reviewer's id and rationale; never auto-clear.

## PSD2 / SCA (S-305)

Strong Customer Authentication for EU payments > €30:

| Factor type | What we use |
| --- | --- |
| Knowledge | PIN inside the app (set during wallet onboarding) |
| Possession | Device-bound key (S-141) |
| Inherence | Biometric (Face ID / Touch ID / Android BiometricPrompt) |

We satisfy 2-of-3 by combining the device-bound key with biometric
unlock. Knowledge factor is held in reserve for high-value transfers.

**Exemptions** we can use:
- TRA (Transaction Risk Analysis): below €100, low-risk by partner score.
- Recurring transactions: subscriptions after the first SCA.

Sign-off from BaaS partner is required before launch (S-302).
