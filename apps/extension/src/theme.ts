import {themeBootstrap} from '@prooffi/ui/theme';
// Bundled external script: extension CSP never needs unsafe-inline.
try { const value=localStorage.getItem('prooffi.theme'); document.documentElement.dataset.theme=value==='dark'||value==='light'?value:'system'; } catch { document.documentElement.dataset.theme='system'; }
void themeBootstrap;
