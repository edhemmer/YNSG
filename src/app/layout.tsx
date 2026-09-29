import type {Metadata,Viewport} from 'next';
import {Header} from '@/components/header';
import {Footer} from '@/components/footer';
import './globals.css';
import './audience.css';
export const metadata:Metadata={title:{default:'Your Neighborhood Service Guy | Home & Yard',template:'%s | Your Neighborhood Service Guy'},description:'Practical home and yard help in DeKalb, Sycamore and Cortland, Illinois.',metadataBase:new URL('https://yourneighborhoodserviceguy.com')};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#092943'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><a className="skip" href="#main">Skip to content</a><Header/><main id="main">{children}</main><Footer/></body></html>}
