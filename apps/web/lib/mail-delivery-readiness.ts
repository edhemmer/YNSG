// Managed mail and legacy Gmail share the same owner approval gate.
// A configured transport alone never authorizes customer delivery.
export function mailDeliveryReady(approved:boolean,managed:{ready:boolean}|null,legacyEnabled:boolean){
 return approved&&(managed?managed.ready:legacyEnabled);
}
