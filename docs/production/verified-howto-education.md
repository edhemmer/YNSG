# YNSG Education — verified how-to product specification
Updated: 2026-10-15. Status: **engineering foundation, not an activated public feature**.

## Product intent
Education answers **what, where, when, which tools, and how** for ordinary home maintenance and equipment. Prioritize problems with real devices: smart locks, wireless doorbells, smart plugs, thermostats, furniture, doors, hardware, caulking, drywall patches, hand tools and basic diagnostics. Show manufacturer/model selection before model-specific instructions. Distinguish **educational content** from services offered by YNSG: explaining a smart lock does not un-hold the company's smart-lock service; explaining light switches does not make YNSG an electrical contractor.

## A lesson screen
1. Plain-language project title, device brand/model and what this guide applies to; publication date and last source check.
2. **Can I safely do this?** skill/tools/prerequisites, who should stop, when a qualified contractor is required, and if a permit/license may be necessary.
3. **Before you start:** photos or manufacturer diagrams if licensed for use, exact tools/parts, compatibility, time **range only if supported**, measurements, expected difficulties, backup plan.
4. **Step 1 / 2 / 3...:** one action and an observable expected result per step; source citation; what to do if it does not match; explicit stop conditions. A mobile-friendly Next / Back sequence and printable complete view. No automatic progress claiming a device is fixed.
5. Two distinguished side panels: **Watch out** for safety/material/warranty hazards and **Pro tip** for a reviewed trade technique. Label the attribution; don't invent a tradesperson or secret. No general AI claims of verified workmanship.
6. Finish: non-destructive functional checks, clean up, when to contact support, source links, model applicability and request service only if that service is actually approved and offered.

## AI operating rules
- Input: project description, optional photo, brand/model, observed issue, installed hardware, existing tools and skill level. Never guess model from a similar appearance; ask for label/manual/part number. 
- Retrieval: prefer original manufacturer model-specific manual/installation/safety bulletins, then qualified trade sources; record publisher, URL, version/date, applicability and last checked. Link out rather than copying manuals/videos.
- Before numbered steps: detect risk. Mains electrical wiring, breaker/panel work, gas, combustion, structural, roof/ladders, garage springs, asbestos/lead, pressure systems and inaccessible work need a professional route. For light switches: offer identification/compatibility questions and safety warnings, **not generic wiring connection steps**. Local permit/licensing rules may apply.
- An AI draft has publication='draft' and no reviewer. Only named qualified human review, checked sources and current model applicability may advance a lesson to reviewed/published. Stale/unavailable source -> hold publication and disclose uncertainty. Do not present generated diagrams as manufacturer diagrams.
- The AI cannot operate the device, open locks, change building settings, buy parts, create billable work or claim a test passed. For smart-home access, emphasize customer authorization and preserving working keys/codes without requesting access codes in chat.
- Every instruction cites its relevant source(s); if evidence does not support the step, remove the step or return a model-specific lookup request. Warnings and tips must be accurate, specific, and auditable.
- Content should be legible on iPhone/iPad with clear buttons, keyboard/screen-reader order, large-print consideration and no moving carousel inside an active step.

## Initial candidate lesson (DRAFT; NOT public)
**Diagnosing a battery-powered smart deadbolt that won't turn consistently**

Applicability: Known Kwikset SmartCode model only after confirming the exact label and matching guide. The following is a diagnostic outline, not universal installation or reset instructions.

**Tools:** manufacturer-specified replacement batteries, flashlight, clean cloth, paper to record non-sensitive observations; an ordinary screwdriver only if the model instructions require it.

**Before starting:** confirm ownership/permission; ensure another working way to enter the property; keep the door open for device tests; inspect the manufacturer's instructions before opening any cover.

1. **Identify the exact model and symptom.** Find the brand/model label and note whether the keypad, mobile app, thumbturn, or bolt behaves unexpectedly. Expected: one clearly described failure. Stop if ownership or backup access is uncertain.
2. **Check power without resetting.** For a model that allows owner battery replacement, follow that model's battery specification and polarity; observe its status indicator. Expected: status behavior matches the manufacturer's guide. Stop if the compartment is damaged, wet, or overheated.
3. **Test with the door open.** Using the manual thumbturn and the manufacturer-approved keypad test, observe whether the bolt extends smoothly without frame contact. Expected: the bolt moves freely. Stop if it binds or can leave you locked out.
4. **Compare door-open and door-closed symptoms, without forcing the lock.** A difference may indicate misalignment at the strike/bolt pocket; refer to the precise model guidance. Do not drill, cut, adjust a fire-rated door, or perform unapproved work from this generic outline.
5. **Only if model-specific instructions direct it:** review door handing/calibration. Procedures vary significantly between models. Never use a guessed reset sequence; do not erase access codes or pairings without explicit consent and recovery steps.
6. **Close out:** record what changed and test with backup access in place. If failure persists, stop and contact model support or a qualified locksmith.

**Watch out:** Testing a powered lock with the door closed can trap you outside; keep the door open until function is confirmed. Do not disclose customer access codes in AI prompts.

**Pro tip (manufacturer-supported):** A lock that works with the door open but fails against the strike may be binding on the door/frame rather than having a dead motor. Diagnose before buying a replacement.

**Source references checked on 2026-10-15:**
- Kwikset door handing help: https://www.kwikset.com/support/topics/door-handing-process
- Kwikset deadbolt/latch alignment answer: https://www.kwikset.com/support/answers/i-have-installed-my-kevo-smart-lock-but-the-latch-will-not-correctly-extend-or-retract-i-hear-a-clicking-sound
- ESFI DIY electrical safety: https://www.esfi.org/do-it-yourself-diy-electrical-safety/
- ESFI switch installation and warnings: https://www.esfi.org/switch-to-safety/

## Release gates
- Reviewed database source registry and lesson versions, per-tenant owner drafts, separate public publication authority, revocation and audit.
- Source fetch/revalidation (including link rotation), signed editorial review, no unlicensed copied media; copyright and accessibility audit.
- Exact product/model matching, robust no-match behavior, safety classification, hallucination/injection adversarial tests, hardware/vendor outage cases, explicit escalation.
- Three completely reviewed pilot lessons including one low-risk project, one smart device, and one restricted electrical-awareness guide; test on real phone and iPad.
- No paid AI activation, no new YNSG regulated service, and no public publication before owner approval and gates.
