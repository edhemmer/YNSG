export declare const businessIdentity: Readonly<{
  brandName: string;
  legalName: string;
  phoneDisplay: string;
  phoneE164: string;
  website: string;
  app: string;
  profiles: readonly string[];
  searchVerification: Readonly<{ google: string; bing: string }>;
  hours: Readonly<{ days: string[]; opens: string; closes: string; label: string }>;
  social: Readonly<{ facebook: string; instagram: string }>;
  publicEmail: string;
  googleReviewUrl: string;
}>;
export declare const printIdentity: Readonly<{
  logo: string;
  tagline: string;
  websiteLabel: string;
  website: string;
}>;
