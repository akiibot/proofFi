export type Preview={tabId:number;captured_at:string;navigation_key:string;source_url:string;title:string;page_kind:'investment'|'expense'|'unknown';selected_text:string};
export function safePageUrl(value:unknown):string|null;
export function classify(text:unknown):'investment'|'expense'|'unknown';
export function redact(text:unknown):string;
export function validPreview(value:unknown):value is Preview;
export function observedSender(sender:chrome.runtime.MessageSender,id:string):boolean;
export function pageIdentity(value:unknown):Promise<string|null>;
