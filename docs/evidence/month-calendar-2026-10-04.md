# Owner month calendar — October 4, 2026

Owner request: Calendar must show the days of the month like a paper calendar, with useful graphics.

Implemented: seven-column Sunday–Saturday grid; previous/next month and Today; marked current and selected days; service-color legend and dots; active visit counts; blocked-day labels; selected-day appointment details and service-request links. The month grid precedes Google setup, which remains in an expandable owner-only control. Settings naming and readable typography are preserved.

Data: owner/admin authenticated month endpoint, explicit organization membership plus existing RLS. Company timezone determines boundaries. Appointment fetch is independent of the workspace's 50-record pages. The bounded 3,000-record ceiling rejects overflow instead of showing a partial month as complete. Blocked intervals are intersected with the month. Requests are fetched in bounded batches. Canceled records and expired holds remain in day details but are excluded from active visit counts. No booking, Google permissions or delivery switches are changed by opening the calendar. Personal Google events are not imported or promised. Empty cells are not presented as confirmed availability.

Local verification: six calendar-domain tests passed for weekday alignment, leap years, December/January, Chicago DST boundaries, multi-day blocks, exclusive midnight ends, mixed-service colors, and inactive appointment counts. Existing suite passed before the final inactive-count addition. TypeScript and optimized build passed. Navigation and calendar-block refresh callback were reviewed; asynchronous month results are canceled and fenced on company/month changes.

Live gate: deployment and anonymous access denial are checked separately. Actual signed-in owner records, clicks, phone layout and Google-provider behavior need live acceptance; no authenticated browser or provider acceptance is claimed here.
