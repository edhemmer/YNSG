import Image from 'next/image';
import Link from 'next/link';
import { Phone } from 'lucide-react';
export function Header() { return <header className="site-header"><div className="container header-inner">
  <Link href="/" className="brand" aria-label="Your Neighborhood Service Guy, home"><Image src="/brand/ynsg-logo.jpg" width={1536} height={1024} sizes="160px" alt="" priority /></Link>
  <nav className="desktop-nav" aria-label="Main navigation"><Link href="/services">Services</Link><Link href="/pricing">Rates</Link><Link href="/about">About</Link></nav>
  <a className="header-phone" href="tel:+17706302094"><Phone size={17} aria-hidden="true" /> <span>770-630-2094</span></a>
  <Link className="button button-primary header-request" href="/request">Request help</Link>
  <details className="mobile-nav"><summary>Menu</summary><nav aria-label="Mobile navigation"><Link href="/services">Services</Link><Link href="/pricing">Rates</Link><Link href="/about">About</Link><Link href="/request">Request help</Link><a href="tel:+17706302094">Call 770-630-2094</a></nav></details>
</div></header>; }
