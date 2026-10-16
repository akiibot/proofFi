import { chainStatusLabel, formatWeiAsEth, shortAddress } from '@/lib/format';
import type { ChainStatus } from './use-dashboard-data';

export function ChainPanel({ chain }: { chain: ChainStatus }) {
  const eth = chain.native_balance_wei ? formatWeiAsEth(chain.native_balance_wei) : null;
  return <section className="chain" aria-label="Chain status">
    <div className="chain-head">
      <h2>Chain status</h2>
      <span className={`pill pill-${chain.status.toLowerCase()}`}>{chainStatusLabel(chain.status)}</span>
    </div>
    <p>{chain.reason}</p>
    <dl>
      <div><dt>Network</dt><dd>Base Sepolia testnet · chain id {chain.chain_id}</dd></div>
      <div><dt>Wallet</dt><dd>{chain.wallet_address ? <code title={chain.wallet_address}>{shortAddress(chain.wallet_address)}</code> : 'Not set'}</dd></div>
      <div><dt>Gas balance</dt><dd>{chain.native_balance_wei ? (eth ? `${eth} ETH` : `${chain.native_balance_wei} wei`) : 'Not available'}</dd></div>
      <div><dt>Token balance</dt><dd>{chain.token_balance_base_units ? `${chain.token_balance_base_units} base units` : 'Not available'}</dd></div>
    </dl>
  </section>;
}
