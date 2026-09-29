import type { Metadata } from 'next';
import { RequestForm } from '@/components/request-form';

export const metadata: Metadata = {
  title: 'Request home or yard help',
  description: 'Tell Your Neighborhood Service Guy about the home or yard job you have in mind in DeKalb, Sycamore or Cortland. Call or send a short request.',
  alternates: { canonical: '/request' },
};

export default async function RequestPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const { service } = await searchParams;
  return <RequestForm initialService={service} />;
}
