// The background Google drift check is queued in the first minute of each hour only.
export const reconcileDue = (at: number = Date.now()) => Math.floor(at / 60000) % 60 === 0;
