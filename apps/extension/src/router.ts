export function navigate(path:string) { window.location.hash=path; }
const router={replace:navigate,push:navigate};
export function useRouter(){return router;}
