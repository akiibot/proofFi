const PRIVATE=/\b(password|passphrase|secret|api[-_ ]?key|access[-_ ]?token|session|csrf|bearer|private key|seed phrase|account number|card number|cvv|iban|routing number)\b/i;
export function safePageUrl(value){
 try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return null;u.search='';u.hash='';return u.href;}catch{return null;}
}
export function classify(text){
 if(typeof text!=='string')return 'unknown';
 const value=text.toLowerCase();
 const investment=['expense ratio','fund facts','investment','redemption','portfolio','etf','annual return','yield'];
 const expense=['subscription','billing','invoice','next payment','renewal','per month','monthly payment'];
 const score=words=>words.filter(word=>value.includes(word)).length;
 const a=score(investment),b=score(expense);
 return a>=2&&a>b?'investment':b>=2&&b>a?'expense':'unknown';
}
export function redact(text){
 if(typeof text!=='string')return '';
 return text.split(/\r?\n/).filter(line=>!PRIVATE.test(line))
 .map(line=>line.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email removed]')
 .replace(/\b(?:\d[ -]?){13,19}\b/g,'[number removed]')
 .replace(/\b0x[a-f0-9]{40,}\b/gi,'[address removed]')
 .replace(/\b[A-Za-z0-9_-]{48,}\b/g,'[identifier removed]')).join('\n').slice(0,6000);
}
export function validPreview(value){
 return value&&typeof value==='object'&&Number.isInteger(value.tabId)&&value.tabId>=0&&typeof value.navigation_key==='string'&&/^[a-f0-9]{64}$/.test(value.navigation_key)&&typeof value.captured_at==='string'&&Number.isFinite(Date.parse(value.captured_at))&&safePageUrl(value.source_url)===value.source_url&&typeof value.title==='string'&&value.title.length<=240&&['investment','expense','unknown'].includes(value.page_kind)&&typeof value.selected_text==='string'&&value.selected_text.length<=6000;
}
export function observedSender(sender,id){
 return sender?.id===id&&Number.isInteger(sender.tab?.id)&&sender.frameId===0&&safePageUrl(sender.url)!==null;
}

// Bind the complete browser location without retaining its query or fragment text.
export async function pageIdentity(value){
 if(!safePageUrl(value))return null;
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(new URL(value).href));
 return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
}
