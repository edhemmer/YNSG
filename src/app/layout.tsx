import type {Metadata,Viewport} from 'next';
import {Header} from '@/components/header';
import {Footer} from '@/components/footer';
import './globals.css';
import './audience.css';
import './mobile.css';
export const metadata:Metadata={title:{default:'Home & Yard Help in DeKalb, Sycamore & Cortland | Your Neighborhood Service Guy',template:'%s | Your Neighborhood Service Guy'},description:'Practical home and yard help for seniors, veterans, single moms, and people with disabilities in DeKalb, Sycamore, and Cortland, Illinois.',keywords:['home help DeKalb IL','yard help Sycamore IL','lawn care Cortland IL','senior help','veteran community rate'],metadataBase:new URL('https://yourneighborhoodserviceguy.com'),alternates:{canonical:'/'},openGraph:{title:'Your Neighborhood Service Guy | Home & Yard Help',description:'Practical help around the home and yard in DeKalb, Sycamore, and Cortland, Illinois.',url:'https://yourneighborhoodserviceguy.com',siteName:'Your Neighborhood Service Guy',locale:'en_US',type:'website'},robots:{index:true,follow:true}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#123247'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><a className="skip" href="#main">Skip to content</a><Header/><main id="main">{children}</main><Footer/></body></html>}
