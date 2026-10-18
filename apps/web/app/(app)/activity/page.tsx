import { Suspense } from 'react';
import { ActivityScreen } from '@/screens/activity/ActivityScreen';

export default function ActivityPage() {
  return <Suspense><ActivityScreen /></Suspense>;
}
