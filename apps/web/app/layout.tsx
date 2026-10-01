import type {Metadata} from 'next';import './style.css';
export const metadata:Metadata={title:'Service workspace',description:'Manage service requests and customer work.',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><a className="skip" href="#main">Skip to content</a>{children}</body></html>}
