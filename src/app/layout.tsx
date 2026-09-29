import type { Metadata, Viewport } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import './globals.css';

const origin = 'https://yourneighborhoodserviceguy.com';
export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: { default: 'Your Neighborhood Service Guy | Home & Yard', template: '%s | Your Neighborhood Service Guy' },
  description: 'Local home and yard help in DeKalb, Sycamore and Cortland, Illinois. Call or send a short request about lawn care, garden beds, snow clearing or jobs around the home.',
  openGraph: { type: 'website', locale: 'en_US', siteName: 'Your Neighborhood Service Guy', url: origin },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f7f5ee' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a><Header /><main id="main">{children}</main><Footer /></body></html>;
}
