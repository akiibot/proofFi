import type { CSSProperties } from 'react';
import { Button, TextLink } from '@/ui/Button';
import { Icon, type IconName } from '@/ui/Icon';
import styles from '@/screens/auth/auth.module.css';

const POINTS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'lock', title: 'You set the rules', text: 'Protect your tuition, cap what the AI may do alone. Only you can change them.' },
  { icon: 'ai', title: 'The AI suggests', text: 'An independent checker tests every idea against your rules and 1,000 possible futures.' },
  { icon: 'check', title: 'Nothing moves without proof', text: 'A signed check, plus your OK whenever your rules ask for it.' },
];

/** Figma "02 First run": the architecture is taught once, then never repeated. */
export default function Welcome() {
  return <main className={styles.center}>
    <section className={styles.welcome} aria-labelledby="welcome-title">
      <p className="t-overline c-low">Welcome</p>
      <h1 id="welcome-title" className="t-h4">An AI that can suggest, but never decide.</h1>
      <ul className={styles.points}>
        {POINTS.map((p, i) => <li key={p.title} className={styles.point} style={{ '--i': i } as CSSProperties}>
          <span className={styles.tile} aria-hidden><Icon name={p.icon} size={24} /></span>
          <span className={styles.pointText}><strong>{p.title}</strong><span>{p.text}</span></span>
        </li>)}
      </ul>
      <div className={styles.actions}>
        <Button kind="primary" size="lg" href="/rules">Review my rules</Button>
        <TextLink href="/">Go to Home</TextLink>
      </div>
    </section>
    <p className={styles.footnote}>Testnet demo · synthetic money</p>
  </main>;
}
