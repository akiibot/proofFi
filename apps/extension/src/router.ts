import {useMemo,useSyncExternalStore} from 'react';
export function navigate(path:string) { window.location.hash=path; }
const router={replace:navigate,push:navigate};
const subscribe=(changed:()=>void)=>{window.addEventListener('hashchange',changed);return()=>window.removeEventListener('hashchange',changed);};
const snapshot=()=>window.location.hash.slice(1)||'/';
export function useRouter(){return router;}
export function usePathname(){return useSyncExternalStore(subscribe,snapshot,()=>'/').split('?')[0];}
export function useSearchParams(){const route=useSyncExternalStore(subscribe,snapshot,()=>'/');return useMemo(()=>new URLSearchParams(route.split('?')[1]??''),[route]);}
