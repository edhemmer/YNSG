import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const requestSchema = z.object({
  service: z.enum(['Lawn care', 'Yard & garden', 'Snow clearing', 'Help around the home', 'Something else']),
  description: z.string().trim().min(10).max(3000),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(35),
  email: z.union([z.email().max(254), z.literal('')]).optional().default(''),
  street: z.string().trim().min(5).max(200),
  city: z.enum(['DeKalb', 'Sycamore', 'Cortland']),
  preferredTime: z.string().trim().max(180).optional().default(''),
  communityRate: z.enum(['Yes', 'No']).optional().default('No'),
  website: z.string().max(200).optional().default(''),
}).strict();

const failure = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.nextUrl.host) return failure('Request not accepted.', 403);
  if (Number(request.headers.get('content-length') || 0) > 12_000) return failure('Request is too large.', 413);
  let body: unknown;
  try { body = await request.json(); } catch { return failure('Please check the form and try again.', 400); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return failure('Please check the required fields and try again.', 400);
  const data = parsed.data;
  if (data.website) return NextResponse.json({ ok: true, id: randomUUID() });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REQUEST_FROM_EMAIL;
  if (!apiKey || !from) return failure('The form is temporarily unavailable. Please call or text 770-630-2094.', 503);

  const id = randomUUID();
  const lines = [
    ['Request ID', id], ['Received', new Date().toISOString()], ['Service', data.service],
    ['Job', data.description], ['Name', data.name], ['Phone', data.phone],
    ['Email', data.email || 'Not provided'], ['Address', `${data.street}, ${data.city}, IL`],
    ['Preferred time', data.preferredTime || 'Not specified'], ['Community Rate inquiry', data.communityRate],
  ];
  try {
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: ['edhemmer@gmail.com'],
        ...(data.email ? { reply_to: data.email } : {}),
        subject: 'Your Neighborhood Service Guy New Request',
        text: lines.map(([label, value]) => `${label}: ${value}`).join('\n\n'),
      }),
    });
    if (!sent.ok) {
      console.error('Request email provider returned status', sent.status);
      return failure('The form could not send your request. Please call or text 770-630-2094.', 502);
    }
    return NextResponse.json({ ok: true, id });
  } catch {
    console.error('Request email provider could not be reached');
    return failure('The form could not send your request. Please call or text 770-630-2094.', 502);
  }
}
