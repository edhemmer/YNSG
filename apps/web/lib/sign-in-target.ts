type Membership = { role: string; revoked_at?: string | null };
// These destinations are fixed application paths, never user-supplied URLs.
// Routing does not grant access; each destination still checks live permissions.
export function signInTarget(destination: string | undefined, memberships: Membership[]): string {
 if (destination === 'password') return '/account?password=change';
 if (destination === 'google-owner') return '/owner?setup=google';
 if (destination === 'owner') return '/owner';
 if (destination === 'account') return '/account';
 const active = memberships.filter(row => !row.revoked_at);
 if (active.some(row => ['owner', 'admin'].includes(row.role))) return '/owner';
 if (active.some(row => ['dispatcher', 'technician', 'bookkeeper'].includes(row.role))) return '/';
 return '/account';
}
