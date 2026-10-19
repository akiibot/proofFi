import createClient from 'openapi-fetch';
import type {paths} from '../../web/src/lib/schema';
export const api=createClient<paths>({baseUrl:'http://extension.local',fetch:async(input:RequestInfo|URL,init?:RequestInit)=>{
 const request=input instanceof Request?input:new Request(input,init);
 const result=await chrome.runtime.sendMessage({type:'API',method:request.method,path:new URL(request.url).pathname,body:request.method==='GET'?null:await request.text()});
 if(!result)throw new Error('Extension worker unavailable');
 return new Response(result.body,{status:result.status,headers:{'Content-Type':'application/json'}});
}});
