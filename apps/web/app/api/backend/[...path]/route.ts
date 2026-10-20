import { NextRequest, NextResponse } from 'next/server';

type Context = { params: Promise<{ path: string[] }> };
const reads = new Set(['health','financial-state','constitutions/drafts','constitutions/history','chain/status','audit','auth/session','auth/access']);
const writes = new Set(['auth/login','auth/judge','auth/logout','intent/parse','plans/generate','simulate','optimize','verify','approvals','execute','constitutions/drafts','constitutions/confirm','workflows/goal','demo/attack','demo/emergency','demo/reset']);

async function forward(request: NextRequest, context: Context) {
  const segments = (await context.params).path;
  const route = segments.join('/');
  const certificate = segments.length >= 2 && segments[0] === 'certificates' && /^[A-Za-z0-9_-]{1,100}$/.test(segments[1]);
  const executionRead = segments.length === 2 && segments[0] === 'executions' && /^[A-Za-z0-9_-]{1,100}$/.test(segments[1]);
  const allowed = request.method === 'GET'
    ? reads.has(route) || executionRead || (certificate && segments.length === 2)
    : writes.has(route) || (certificate && segments.length === 3 && segments[2] === 'verify');
  if (!allowed) return NextResponse.json({code:'NOT_IMPLEMENTED',message:'Route not available',reasons:[]},{status:501});
  // Never forward arbitrary identity, authorization, host or proxy headers.
  const headers = new Headers();
  const cookie = request.cookies.get('prooffi_session')?.value;
  if (cookie) headers.set('Cookie',`prooffi_session=${cookie}`);
  for (const name of ['Origin','X-CSRF-Token']) {
    const value = request.headers.get(name);
    if (value) headers.set(name,value);
  }
  let body: string | undefined;
  if (request.method === 'POST') {
    const length = Number(request.headers.get('Content-Length') ?? 0);
    if (length > 65536) return NextResponse.json({code:'VALIDATION_ERROR',message:'Request too large',reasons:[]},{status:413});
    body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 65536) return NextResponse.json({code:'VALIDATION_ERROR',message:'Request too large',reasons:[]},{status:413});
    headers.set('Content-Type','application/json');
  }
  // Expense recording includes the same independent optimizer recalculation.
  const timeoutMs = route === 'intent/parse' || route === 'plans/generate' || route === 'optimize' || route === 'demo/emergency' ? 35000 : 10000;
  try {
    const response = await fetch(`${process.env.API_BASE_URL ?? 'http://127.0.0.1:8000'}/${route}`,{
      method:request.method,headers,body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(timeoutMs),
    });
    const result = new NextResponse(await response.text(),{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
    for (const value of response.headers.getSetCookie()) result.headers.append('Set-Cookie',value);
    return result;
  } catch {
    return NextResponse.json({code:'UNAVAILABLE',message:'Backend unavailable. Start both services with npm run dev.',reasons:[]},{status:503});
  }
}
export async function GET(request: NextRequest, context: Context) { return forward(request,context); }
export async function POST(request: NextRequest, context: Context) { return forward(request,context); }
