// Deliberately fail closed until a verified sender, durable intake store,
// anti-abuse controls, private uploads and delivery tests are configured.
// No request body is persisted, logged or forwarded by this preview endpoint.
export async function POST(){return Response.json({message:'Online requests are not active yet. Nothing has been sent. Please call or text us at 770-630-2094.'},{status:503,headers:{'Cache-Control':'no-store'}})}
