import { NextRequest, NextResponse } from 'next/server';

// Local foundation exposes only these reads. PF-033 adds authenticated sessions
// and explicit mutation forwarding; never make this an arbitrary open proxy.
const allowed = new Set(['health','financial-state','constitutions/drafts','chain/status','audit']);
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const route = (await context.params).path.join('/');
  if (!allowed.has(route)) return NextResponse.json({ code:'NOT_IMPLEMENTED', message:'Route not available in foundation' },{status:501});
  if (!process.env.API_TOKEN) return NextResponse.json({ code:'UNAVAILABLE', message:'Run bootstrap and start with npm run dev' },{status:503});
  try {
    const response = await fetch(`${process.env.API_BASE_URL ?? 'http://127.0.0.1:8000'}/${route}`, {
      headers:{Authorization:`Bearer ${process.env.API_TOKEN}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000),
    });
    return new NextResponse(await response.text(),{ status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'} });
  } catch {
    return NextResponse.json({code:'UNAVAILABLE',message:'Backend unavailable. Start both services with npm run dev.'},{status:503});
  }
}
