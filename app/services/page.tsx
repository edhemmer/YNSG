import Services from '@/components/Services';
import Boundaries from '@/components/Boundaries';
export const metadata={"title": "Home & yard services", "description": "Explore lawn care, yard help, snow clearing, and cosmetic home repairs in DeKalb, Sycamore, and Cortland.", "alternates": {"canonical": "/services"}};
export default function Page(){return <div className="wrap"><div className="page-head"><p className="eyebrow">PRACTICAL HELP, CLOSE TO HOME</p><h1>Here’s the kind of work we do.</h1><p className="intro">Take a look through the services. If you’re not sure where your job fits, choose Something Else and describe it. We’ll check the scope before we say yes.</p></div><section className="content-section"><Services/><Boundaries/></section></div>}
