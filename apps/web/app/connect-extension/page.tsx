import {Suspense} from 'react';
import {PairingScreen} from '@/screens/settings/PairingScreen';
export default function ConnectExtension(){return <Suspense fallback={<p>Loading connection…</p>}><PairingScreen/></Suspense>;}
