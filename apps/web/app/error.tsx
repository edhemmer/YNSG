'use client';
export default function ErrorPage({reset}:{reset:()=>void}) {
 return <main id="main" className="shell"><section className="card"><h1>We couldn’t open this page.</h1><p>Please try again. If this keeps happening, contact the business.</p><button onClick={reset}>Try again</button><p><a href="/owner">Return to sign-in</a></p></section></main>;
}
