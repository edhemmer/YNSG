# Owner visit design acceptance — 15 October 2026

Problem: the field owner's visit header mixed service names and potentially long customer instructions before the date, while repeating context labels and appointment cards. This made a saved visit harder to scan on a phone.

The service workflow now presents a short visit identity, individual service chips, compact Call/Directions actions, guided stages and the saved next action. A distinct appointment overview displays confirmed/proposed/review status, local date, arrival and reserved window. Original customer instructions follow in a separate disclosure, expanded during confirmation. They are neither summarized away nor discarded. The appointment management section retains the scheduling action without repeating the same primary appointment card. Historical copies remain in the collapsed evidence section. The outer workspace context paragraph is hidden only when a specific visit is open; the back-to-all-workflows control remains visible.

## Pass/fail checklist

- Preserve the official logo and existing navy/forest/gold/cream colors and light/dark themes.
- Keep arrival, reserved window and status distinct; amber means pending, green means confirmed, and labels accompany color.
- Do not use a completion checkmark to represent a merely requested service.
- Keep service chips readable at 16px, supporting instructions at 16px and mobile entry at 18px.
- Keep Call/Directions at least 44px high without forcing two oversized full-width rows.
- Keep all customer instructions available and initially expanded during confirmation.
- Retain the current four workflow stages, appointment management, pending-invoice preview, customer editing link and financial controls.
- Do not change saved records, pricing, approvals, work, invoices, payments, outbox recipients or permissions through this presentation change.
- Verify rendered ordering, notes, one primary appointment overview, and the existing scheduling/invoice/retry tests.
- Require release checks, exact-head PostgreSQL CI, optimized deployment, and live read-only visual verification before describing this presentation as live.
- Keep physical iPhone/iPad keyboard, VoiceOver, large-text, dark-mode and complete lifecycle acceptance open until directly evidenced.

A successful automated check does not establish a design award, Apple approval or universal reliability. Review the complete connected workflow against the governing checklist before closing the broader product acceptance task.
