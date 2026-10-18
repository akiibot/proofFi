import { Suspense } from 'react';
import { ActivityScreen } from '@/screens/activity/ActivityScreen';
import { CheckDialog } from '@/screens/activity/CheckDialog';

/** Figma 17: the check opens as a dialog over Activity. */
export default function CheckPage() {
  return <Suspense><ActivityScreen /><CheckDialog /></Suspense>;
}
