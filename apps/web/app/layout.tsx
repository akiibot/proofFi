import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// Body and mono come from the Figma type collection. The display face is Ambit when installed;
// Instrument Sans is the free stand-in so the headline rhythm holds everywhere else.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });
const display = Instrument_Sans({ subsets: ['latin'], variable: '--font-display-fallback', display: 'swap' });

export const metadata: Metadata = { title: 'ProofFi', description: 'An AI that can suggest, but never decide. Your rules protect your money.' };
export const viewport: Viewport = { themeColor: '#121212', colorScheme: 'dark' };

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${mono.variable} ${display.variable}`}><body>{children}</body></html>;
}
