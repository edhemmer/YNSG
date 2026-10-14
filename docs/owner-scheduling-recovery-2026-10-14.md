# Owner scheduling recovery

The owner scheduling panel previously unlocked editing after any failed response. A lost response could conceal a committed appointment, allow a changed payload/new key and leave the parent workspace busy after the panel closed. This release retains the exact serialized command, blocks editing/navigation while its outcome is unknown, and offers Check saved result. A synchronous in-flight guard prevents rapid duplicate clicks.

The server distinguishes named deterministic scheduling/access rejections from unknown transport/database failures. Unknown failures return 503 and never claim that the appointment was not changed. Canonical Postgres command receipts remain the authority for an identical retry, including travel checks and prior committed results. No new permissions, provider activation or database migration is introduced.

Definitive conflicts refresh context without claiming confirmation. The private scheduling note remains controlled and survives that refresh. Unsaved edits use the existing navigation warning. Closing a successfully confirmed panel clears its parent busy lock. Confirmation and subsequent email/provider delivery remain distinct.

Synthetic rendered-component tests cover lost response, frozen editing/navigation, exact replay, rapid clicks, definite conflict/note retention, error classification and parent-lock cleanup. No real appointment is scheduled during validation. Reloading/discarding a browser tab is not durable offline recovery: beforeunload warns, but the owner must review saved appointments after forcing a reload. Physical-device/user acceptance and external launch gates remain open.
