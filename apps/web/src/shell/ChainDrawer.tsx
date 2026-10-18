'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatWeiAsEth, shortAddress } from '@/lib/format';
import { run } from '@/lib/request';
import { Button, TextLink } from '@/ui/Button';
import { KeyValue, KeyValueList, Skeleton, Status } from '@/ui/kit';
import { Drawer } from '@/ui/overlay';
import { useApp } from './AppContext';
import styles from './shell.module.css';

const ADDRESS_URL = (address: string) => `https://sepolia.basescan.org/address/${address}`;
const grouped = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Figma "03b Chain status": read-only testnet readiness. Ready never authorizes anything. */
export function ChainDrawer() {
  const { chain, chainProblem, checkedAt, chainOpen, setChainOpen, refreshChain } = useApp();
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!chainOpen) return;
    let live = true;
    void Promise.all([run(() => api.GET('/financial-state')), run(() => api.GET('/constitutions/history'))]).then(([state, history]) => {
      if (!live || !state.ok || !history.ok) return;
      const active = history.data.find((v) => v.id === state.data.active_constitution_version);
      setToken(active?.rules.allowed_tokens[0] ?? null);
    });
    return () => { live = false; };
  }, [chainOpen]);

  async function recheck() { setChecking(true); try { await refreshChain(); } finally { setChecking(false); } }

  const ready = chain?.status === 'READY';
  const label = chainProblem ? 'Could not check the testnet' : !chain ? 'Checking…' : ready ? 'Ready · read-only checks passed' : chain.status === 'CHAIN_NOT_CONFIGURED' ? 'Not configured' : 'Unavailable';
  const eth = chain?.native_balance_wei ? formatWeiAsEth(chain.native_balance_wei) : null;

  return <Drawer open={chainOpen} onClose={() => setChainOpen(false)} title="Your testnet connection">
    <section className={styles.chainBody} aria-label="Chain status">
      <Status state={chainProblem ? 'fail' : !chain ? 'pending' : ready ? 'pass' : 'attention'}>{label}</Status>
      <p className="t-body-2 c-med">{chainProblem ? chainProblem.message : chain?.reason ?? 'Asking the backend for read-only chain checks.'}</p>
      <p className="t-body-2 c-med">Ready means ProofFi can see the network and your balances. It does not approve or send anything; only a signed certificate and your OK can.</p>
      {!chain && !chainProblem && <div className={styles.chainSkeleton}><Skeleton height={20} /><Skeleton height={20} width="70%" /><Skeleton height={20} width="85%" /></div>}
      {chain && <KeyValueList label="Testnet details">
        <KeyValue label="Network" value={`Base Sepolia testnet · chain ${chain.chain_id}`} />
        <KeyValue label="Wallet" mono value={chain.wallet_address ? <span title={chain.wallet_address}>{shortAddress(chain.wallet_address)}</span> : 'Not set'} />
        <KeyValue label="Gas for fees" mono value={chain.native_balance_wei ? (eth ? `${eth} ETH` : `${chain.native_balance_wei} wei`) : 'Not available'} />
        <KeyValue label="Test tokens" value={chain.token_balance_base_units ? `${grouped(chain.token_balance_base_units)} base units` : 'Not available'} />
        {token && <KeyValue label="Token" mono value={<span title={token}>{shortAddress(token)}</span>} />}
        <KeyValue label="Last checked" value={checkedAt ? `${checkedAt.toISOString().replace('T', ' ').slice(0, 16)} UTC` : '—'} />
      </KeyValueList>}
      <p className="t-overline c-low">If this says something else</p>
      <p className="t-body-2 c-med">Not configured or Unavailable: sending is switched off. Your rules, plans and approvals are kept, and nothing is lost. Checking certificates still works.</p>
      <div className={styles.chainActions}>
        <Button kind="secondary" onClick={() => void recheck()} busy={checking}>{checking ? 'Checking…' : 'Check again'}</Button>
        {chain?.wallet_address && <TextLink href={ADDRESS_URL(chain.wallet_address)} external icon="arrow-right-up">View wallet on explorer</TextLink>}
      </div>
    </section>
  </Drawer>;
}
