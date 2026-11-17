// SERVICE SATURDAY ON/OFF SWITCH
// To turn it OFF: change `open: true` to `open: false`, commit, and the site redeploys without it.
// To run a new one: set new dates, give it a new `campaign` name, and set `open: true`.
// Dates are Central time, written as YYYY-MM-DD.
export const serviceSaturday = {
  open: true,
  // A new name for each event keeps entries separate (one entry per email per event).
  campaign: 'service-saturday-2026-12',
  // Last day to enter (entries close at 11:59 PM Central that night).
  entryDeadline: '2026-12-06',
  // Day the winner is drawn.
  drawingDate: '2026-12-08',
  // The Saturday the work happens.
  serviceDate: '2026-12-12',
  // Prize details used on the page and in the Official Rules.
  hours: 4,
  approximateValue: 280,
};
