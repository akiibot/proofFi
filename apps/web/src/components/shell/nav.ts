// One place that lists the product screens. Later issues flip `ready` to true and set `href` when their route exists,
// so nothing links to a page that is not built yet.
export type NavItem = { label: string; href: string; ready: boolean; issue: string };

export const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/', ready: true, issue: 'PF-018' },
  { label: 'Constitution', href: '/constitution', ready: false, issue: 'PF-019' },
  { label: 'Workspace', href: '/workspace', ready: false, issue: 'PF-020' },
  { label: 'Time Machine', href: '/time-machine', ready: false, issue: 'PF-021' },
  { label: 'Certificates', href: '/certificates', ready: false, issue: 'PF-022' },
  { label: 'Red team', href: '/red-team', ready: false, issue: 'PF-023' },
  { label: 'Audit', href: '/audit', ready: false, issue: 'PF-025' },
];
