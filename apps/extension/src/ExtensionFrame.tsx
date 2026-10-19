import type {ReactNode} from 'react';
import {AppProvider} from '../../web/src/shell/AppContext';
import {ChainDrawer} from '../../web/src/shell/ChainDrawer';
export function AppFrame({children}:{children:ReactNode}){return <AppProvider>{children}<ChainDrawer/></AppProvider>;}
export function Page({children,className}:{children:ReactNode;className?:string;width?:number}){return <div className={['extension-page',className].filter(Boolean).join(' ')}>{children}</div>;}
