import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About Ed and the business',
  description: 'Meet Ed and learn why Your Neighborhood Service Guy offers practical home and yard help in DeKalb, Sycamore and Cortland, Illinois.',
  alternates: { canonical: '/about' },
};
export default function AboutPage() { return <><section className="page-hero"><div className="container"><p className="eyebrow">About</p><h1>Hi, I’m Ed.</h1><p>I started Your Neighborhood Service Guy for the everyday jobs that can be hard to get to on your own, and too small to call a contractor for.</p></div></section><section className="section"><div className="container about-grid"><div><p className="eyebrow">Why I do this</p><h2>A little help can make a real difference.</h2></div><div className="reading-copy"><p>My family has seen how much the small things matter as parents get older and when a household has more on its plate than one person can comfortably handle. My wife was a single mom before we were together. I know from her experience that having someone dependable to call can take some weight off the day.</p><p>We especially work for seniors, veterans, single moms, and people with disabilities here in DeKalb, Sycamore, and Cortland. Other neighbors can ask too.</p><p>Tell us about the job. We’ll say what we can do, what it will cost, and whether a different kind of professional would be a better fit. That’s how I want to do business.</p><Link className="button button-primary" href="/request">Send a request</Link></div></div></section></>; }
