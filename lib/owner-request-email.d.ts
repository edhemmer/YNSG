import type {EmailIdentity} from './email-layout.js';
export type OwnerSubmission = {
 name?: string; phone?: string; email?: string; street?: string; city?: string;
 description?: string; preferredTime?: string; communityRate?: string;
 service?: string; task?: string; services?: {service: string; task?: string}[];
};
export function ownerRequestEmail(data: OwnerSubmission, selections: {service: string; task?: string}[], id: string, company?: string, region?: string, ownerUrl?: string | null, identity?: EmailIdentity): {html: string; text: string};
