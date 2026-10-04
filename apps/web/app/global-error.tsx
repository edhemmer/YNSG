'use client';
export default function GlobalError({reset}:{reset:()=>void}) {
 return <html lang="en"><body style={{fontFamily:'system-ui, sans-serif',padding:32,color:'#10283c',background:'#f8f6ef'}}><main><h1>We couldn’t open this page.</h1><p>Please try again. If this keeps happening, contact the business.</p><button style={{padding:16,fontSize:18}} onClick={reset}>Try again</button><p><a href="/owner">Return to sign-in</a></p></main></body></html>;
}
