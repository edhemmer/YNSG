export function emailEscape(value: unknown): string;
export function emailParagraph(text: string): string;
export function emailButton(label: string, url: string, secondary?: boolean): string;
export type EmailIdentity = {logoUrl?: string | null; ownerName?: string | null; phone?: string | null; website?: string | null; audience?: 'owner' | 'customer'};
export const YNSG_EMAIL_IDENTITY: Readonly<EmailIdentity>;
export function emailIdentity(settings: {brand?: EmailIdentity} | null | undefined, organization: string): EmailIdentity;
export function emailSignedText(text: string, identity?: EmailIdentity): string;
export function emailLayout(company: string, title: string, preview: string, content: string, identity?: EmailIdentity): string;
