import type { Metadata } from 'next';
import './globals.css';
import { themeBootstrap } from '@prooffi/ui/theme';
export const metadata: Metadata = { title:'ProofFi · Financial control', description:'Financial intelligence separated from financial authority.' };
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeBootstrap}} /></head><body>{children}</body></html>;
}
