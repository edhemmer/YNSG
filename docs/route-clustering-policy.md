# Neighborhood route grouping — YNSG owner scheduling policy

Status: **advisory design, not an enabled scheduling algorithm** (2026-11-02).

Purpose: cluster geographically nearby appointments to reduce unpaid travel, mileage, gas costs and schedule fragmentation, without limiting who can request service.

Illustrative owner preferences only:
- East/Fox Valley: St. Charles, Campton Hills, Lily Lake, Elburn and Geneva — Monday/Tuesday when sufficient jobs are available.
- Home/central: DeKalb, Sycamore, Cortland, Maple Park — Wednesday/Thursday.
- Friday: flexible overflow, urgent needs, large projects and farms.

These are NOT eligibility rules or customer-facing promises. An urgent job, customer constraint, route-efficient alternative or actual confirmed booking always overrides suggested days. City names are a starting point; route planning must use verified addresses and real travel time.

Future implementation must: group pending jobs by location and appointment duration; consider existing confirmed appointments, travel buffers, equipment and material pickup; estimate drive time only when a routing service provides it; suggest times without auto-booking; require owner approval before any reschedule or message; preserve idempotency, audit trail, offline fallback, customer preference and no double-booking protections.

Acceptance tests before activation: route clustering; out-of-zone emergency; customer date retained; recurring visits protected; confirmed appointments unchanged; no hard service-area rejection; address or routing failure; mobile one-tap override; actual drive buffer; no duplicate booking. Keep public request submission functional regardless of availability.
