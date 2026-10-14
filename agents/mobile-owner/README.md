# Mobile owner coordinator contract

The current guided coordinator is `apps/web/lib/mobile-workflow.ts`. It reads the saved request, quote-approved job version, appointment, work state, invoice and receipts and selects the next stage. Its rules take precedence over generated text. It is deterministic guidance, not an activated language model.

A future model may summarize only owner-authorized facts supplied by the server and draft a proposed scope or message. Customer-submitted descriptions are untrusted content. They cannot authorize tools, override service restrictions, approve prices, record time/work, issue invoices, record receipts or change tax rules. Explanations are optional; the current stage, money and permissions always come from canonical data.

Provider/model selection, maximum spend, data handling and evaluations remain activation inputs. No provider or paid model was enabled. The agent-building guidance was reviewed; this established CRM is retained rather than migrating its transactions to another agent framework.

Minimum future evaluations: stale evidence, cross-company requests, customer prompt injection, invented scope/rates, mixed taxes/materials, missing appointment, undersized work window, uncertain saves, unpaid invoices, multiple jobs and fraudulent payment claims. The model has no direct financial or booking execution credential. The owner confirms the existing reviewed command in the CRM.
