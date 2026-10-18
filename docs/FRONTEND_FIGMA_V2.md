# Frontend: Figma v2 design (PF-049, #126)

The contributor reports that the web UI follows the approved Figma file **Fintechathon**, page **Design** (frames `01 Sign in` … `21 Edge states`, plus `03b Chain status` and `12b Version history`). This change replaces the visual layer and the page structure only. API calls, request builders, safety guards, schemas and routes under `/api/backend` are the same code as before.

## Screens and where their data comes from

| Figma frame | Route | Data (all real, nothing mocked) |
|---|---|---|
| 01 Sign in | `/login` | `POST /auth/login`, then `GET /financial-state` to choose First run or Home |
| 02 First run | `/welcome` | none (shown once, while no rules are active) |
| 03 Home, 20 Home after expense | `/` | `GET /financial-state`, `GET /constitutions/history`, `GET /audit`, `GET /chain/status` |
| 03b Chain status | drawer from the header pill | `GET /chain/status` |
| 04 Record expense | dialog on Home | `POST /demo/emergency` (same lock rules as before) |
| 05 Ask, 06 Checking, 07 Answer | `/ask` | `POST /intent/parse`, `/plans/generate`, `/optimize`, `/simulate`, `/verify` |
| 08 Futures | drawer on `/ask` | the `SimulationRun` for exactly the safe amount |
| 09 Approve and send, 10 Proof, 11 Done | `/approve?id=` | `GET /certificates/{id}`, `POST /certificates/{id}/verify`, `GET /audit`, `POST /approvals`, `POST /execute` |
| 12 Rules, 13 edit, 14 review, 12b history | `/rules`, `/rules/history` | `GET /financial-state`, `/constitutions/history`, `/constitutions/drafts`, `POST` drafts and confirm |
| 15 Activity, 16 Story, 17 Check certificate | `/activity`, `/activity/story?certificate=`, `/activity/check` | `GET /audit` (chain re-checked in the browser), `GET /certificates/{id}` |
| 18 Security test, 19 result | `/security` | `POST /demo/attack`, `GET /audit` |
| 21 Edge states | in place on each screen | the real error or status that causes them |

Old addresses still work and redirect (`next.config.mjs`): `/constitution`→`/rules`, `/workspace` and `/time-machine`→`/ask`, `/certificates`→`/approve`, `/red-team`→`/security`, `/audit`→`/activity`, `/certificate-verifier`→`/activity/check`. Query strings are kept.

## Rules the screens keep

- One click can mean two backend calls. "Approve and send" records the decision, re-reads the status and audit, and sends only if the backend now says `VALID`. Approval can never override a failed rule; the backend still decides.
- The request identity for a send is stored in the tab. After a lost response, a reload or a retry can only **reconcile** that one attempt; a new attempt is never sent blindly. An unknown outcome of a decision, a send, an expense or a security test locks further attempts and says why.
- The audit log's hash chain is recomputed in the browser. A broken chain is shown as broken, never as intact.
- Display-only memory (`src/lib/safe-memory.ts`): the last safe amount (for "safe before → now") and the typed goal and suggestions of a certificate (for the story). The audit log records neither, so the story omits those two steps when this browser does not remember them. Nothing stored there is ever sent anywhere or trusted.
- Yellow is used only for the one primary action, "needs you", focus and selected states.

## Structure

- `src/ui/` tokens, icons (outline Atomize icons in `public/icons`), buttons, form controls, drawer and dialog (focus trap, Escape, exit animation), and the shared components named after the Figma components.
- `src/shell/` the signed-in frame: floating top nav with the sliding active pill, the bell count, the account menu and the chain drawer.
- `src/screens/<area>/` one folder per area, each with its data hook and CSS module.
- `src/lib/` and `src/components/{approval,audit,certificates,constitution,simulation,workspace}` the logic modules that existed before, still covered by the unit-style specs.

## Tokens and fonts

`src/ui/tokens.css` is a copy of the Figma variable collections (Color, Size, Type) and the Atomize spacing and radius scale. Body is Inter and mono is JetBrains Mono (`next/font`). The display face in the design is **Ambit**, which is not a web font we can ship; it is used when installed and Instrument Sans stands in everywhere else. Swap it in `--pf-font-display` (`tokens.css`) and `app/layout.tsx`.

## Motion

Short and calm (140–360 ms). Every animation is switched off by `prefers-reduced-motion`. Route changes inside the signed-in frame keep the top nav mounted, so the active pill slides between tabs.


## Integration review

See [PF-049 integration review](PF_049_INTEGRATION_REVIEW.md) for verified behavior,
execution-evidence limits, test provenance, overlap handling and visual acceptance
still needed. Activity never infers confirmation from receipt status alone.
Complete observed execution responses are accepted for display only when their
digest matches the latest hash-verified execution audit artifact. Without matching
evidence the outcome is unknown. The display cache never authorizes an action.
