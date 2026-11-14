import './field-office.css';
import './careers.css';
import './task-time.css';
import '../../../site/request-button.css';
import type {Metadata} from 'next';import Script from 'next/script';import './style.css';import './owner-day.css';import './customer-records.css';import './invoice-closeout.css';
import './owner-network.css';
import './field-system.css';
import './premium.css';
import {Inter} from 'next/font/google';
const inter=Inter({subsets:['latin'],variable:'--font-inter',display:'swap'});
export const metadata:Metadata={title:`${process.env.NEXT_PUBLIC_LOGIN_BRAND || 'Your Neighborhood Service Guy LLC'} | Workspace`,description:'Manage service requests and customer work.',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" className={inter.variable} suppressHydrationWarning><head><Script id="workspace-theme" strategy="beforeInteractive">{`try{var t=localStorage.getItem('ynsg.workspace.theme.v1');document.documentElement.dataset.theme=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch{document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}`}</Script></head><body><a className="skip" href="#main">Skip to content</a>{children}</body></html>}
