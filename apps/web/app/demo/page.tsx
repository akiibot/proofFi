'use client';
import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/ui/Button';
import { Logo } from '@/ui/kit';
import styles from '@/screens/auth/auth.module.css';

// Genuine public hosted evidence from 2026-10-18. Display only: never a live action.
const evidence = 'https://github.com/akiibot/vallet/blob/main/evidence/hosted-action-certificate.json';
const steps = [
  { title: 'Protect tuition first', text: '“Invest as much as possible without risking my tuition.” This recorded example began with $17,000 synthetic cash and explicitly confirmed rules. The AI suggested an action; it did not authorize it.' },
  { title: 'The rules set the limit', text: 'The recorded independent optimizer found a $2,000 maximum after 24 checks. The next cent was rejected. This is the saved result for that historical state and its illustrative assumptions—not a calculation for your current session.' },
  { title: 'A signed proposal explains the decision', text: 'The recorded verifier issued certificate cert-16a53880-aabd-4c6f-b0f9-441256292973. Its signed action binds the $2,000 amount, policy and transaction details. This walkthrough displays the saved evidence; it does not verify a new action or grant permission to send.' },
];
const subscribe = () => () => undefined;
export default function RecordedDemo() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const [step, setStep] = useState(0);
  return <main className={styles.center}>
    <Logo />
    <section className={styles.card} aria-labelledby="recorded-title">
      <p className="t-overline">Recorded example · sending disabled</p>
      <h1 id="recorded-title" className="t-h3">See how Vallet works</h1>
      <p>Instant playback of a genuine run recorded on 18 October 2026. No AI request, live simulation or financial action runs here.</p>
      <p role="status">Step {step + 1} of {steps.length}</p>
      <h2 className="t-h3">{steps[step].title}</h2>
      <p>{steps[step].text}</p>
      {step === 2 && <p><a href={evidence} target="_blank" rel="noreferrer">View the original recorded certificate</a></p>}
      {step < 2 ? <Button wide disabled={!hydrated} onClick={() => setStep(step + 1)}>Next</Button> : <Button wide disabled={!hydrated} onClick={() => setStep(0)}>Replay example</Button>}
      {step > 0 && <Button kind="secondary" onClick={() => setStep(step - 1)}>Back</Button>}
      <p><Button kind="secondary" href="/login#live-demo">Try live</Button></p>
      <p>Live mode creates a separate disposable sandbox and uses real services. Responses take longer and can be unavailable. Sending remains disabled.</p>
    </section>
  </main>;
}
