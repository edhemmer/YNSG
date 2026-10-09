// The visible save/confirm statement is the owner's combined review attestation.
// Optional notes supplement that statement; they are not a separate approval gate.
export function confirmationReview(note: string) {
 const statement = 'Owner confirmed review of requested work, visit length, assigned people and equipment, and any supplier pickup.';
 const trimmed = note.trim();
 if (trimmed.length > 2800) throw new Error('Keep the scheduling note under 2,800 characters.');
 return {scopeReviewed:true as const,equipmentReviewed:true as const,pickupReviewed:true as const,reviewNote:statement+(trimmed?' Note: '+trimmed:'')};
}
