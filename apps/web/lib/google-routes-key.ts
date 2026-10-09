// Server-only names support an existing Maps/suite key without exposing it to clients.
export function googleRoutesKey(env:NodeJS.ProcessEnv=process.env){
 return env.GOOGLE_ROUTES_API_KEY?.trim()||env.GOOGLE_MAPS_API_KEY?.trim()||env.GOOGLE_API_KEY?.trim()||'';
}
