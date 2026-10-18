// This check selects an entirely browser-local transport. Query parameters,
// organization IDs and cookies can never activate practice in a live workspace.
export const practicePath='/owner/practice';
export function isPracticePath(path:string){return path===practicePath||path===practicePath+'/';}
