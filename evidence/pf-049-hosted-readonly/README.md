# PF-049 deployed read-only evidence

Captured 2026-10-19 (Asia/Dhaka) from the actual existing hosted testnet demo,
[prooffi-preview.vercel.app](https://prooffi-preview.vercel.app). These are live
browser screenshots, distinct from the [isolated complete journey](../pf-049-isolated/README.md).
No new transfer, expense, reset, policy activation, signature or dispatch occurred.

- [Home](home.png): current protected money and recorded recent activity.
- [Ask](ask.png): the goal entry screen; no live proposal was submitted.
- [Rules](rules.png): existing active v1 and separately identified inactive draft.
- [Activity](activity.png): all 20 audit events rechecked in the browser.
- [Story](story.png): original confirmed payment, recorded 49 confirmations,
  original-attempt recovery link and intact linked records.
- [Proof drawer](proof.png): existing reconciliation evidence; Escape restored
  focus to its original Proof button.

[Validation summary](validation.json) records exact source/deployment identities,
HTTPS checks and preservation results. Private snapshots, connection strings,
credentials, cookies and individual private table rows are excluded.

The frontend is merged main e944d002d01af64598131c06eaa54bf832b0c35c,
Vercel dpl_DiAni96MivjEhTSGg5LMyPjhQGqh. The backend is approved contract merge
c3942926af4ca178840ad69e7c135c934a96c951, Render dep-dbakofc9v7es738tddb0;
the frontend merge does not change backend application code. Both builds succeeded.
The Vercel production alias was explicitly promoted after build readiness.

Read-only HTTPS checks passed eight HTML pages, twenty JS/CSS assets, all seven
legacy redirects with query preservation, authenticated execution reads, secure
cookie flags, Origin/CSRF refusal and logout revocation. Four actual private
values were checked in memory against retrieved responses: zero matches. This
does not claim a hosted log scan.

Before/after financial state (v3 and its hash), active policy/history/draft,
three certificates, execution and all twenty audit events compare exactly equal.
Independent read-only snapshots of all fifteen private PostgreSQL tables also
compare exactly equal. The older evidence with eighteen events is historical;
the deployment did not reset the hosted store to that earlier snapshot.

Original local A/B/C and previous hosted financial evidence remain intact.
The full redesigned approval/send/reconciliation journey, reorg/threshold cases,
policy activation, emergency repricing and unsafe rejection were tested using
isolated fixtures only. No new live financial journey is claimed.

The owner accepted the current visuals and font fallback. Direct Figma source
comparison remains unperformed because the reference was unavailable. Existing
missing-request-identity recovery work remains tracked separately in #99; no new
request identity is synthesized. Older overlapping PR #114 remains separate.
