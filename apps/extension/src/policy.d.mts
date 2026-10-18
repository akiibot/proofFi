export const BACKEND:string;export const WEB:string;
export function allowed(method:unknown,path:unknown):boolean;
export function sensitive(path:string):boolean;
export function deadline(path:string):number;
export function trustedSender(sender:{id?:string;url?:string},id:string):boolean;
export function journalFrom(value:unknown):Record<string,{path:string;body:string;state:'sending'|'observed'|'unknown'}>;
