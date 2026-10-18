import { AppFrame } from '@/shell/AppFrame';

/** Every signed-in screen shares one frame, so the top nav (and its sliding pill) persists between pages. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppFrame>{children}</AppFrame>;
}
