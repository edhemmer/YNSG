// SERVICE SATURDAY ON/OFF SWITCH
// To turn it OFF: change `open: true` to `open: false`, commit, and the site redeploys without it.
// To run a new one: set new dates, give it a new `campaign` name, and set `open: true`.
// Dates are Central time, written as YYYY-MM-DD.
export const serviceSaturday = {
  open: true,
  // A new name for each event keeps entries separate (one entry per email per event).
  campaign: 'service-saturday-2027-01',
  // First day entries are accepted (shown in the Official Rules).
  startDate: '2026-11-17',
  // Last day to enter (entries close at 11:59 PM Central that night).
  entryDeadline: '2027-01-17',
  // Day the winner is drawn.
  drawingDate: '2027-01-19',
  // The Saturday the work happens.
  serviceDate: '2027-01-23',
  // The drawing happens only once this many eligible entries are in. If entries close short of it,
  // the entry period extends in 2-week steps (update the three dates above and redeploy) until the
  // minimum is reached or the final entry date passes, when the promotion ends without a drawing.
  minimumEntries: 35,
  finalEntryDate: '2027-03-28',
  // Prize details used on the page and in the Official Rules.
  hours: 4,
  approximateValue: 280,
};
