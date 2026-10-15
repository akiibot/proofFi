"""Idempotent issue publisher. Never closes issues or claims PRs are merged."""

import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def gh(*args):
    return subprocess.check_output(["gh", *args], cwd=ROOT, text=True).strip()


def render_manifest(rows, repo):
    lines = [
        "# Implementation backlog",
        "",
        f"Repository: https://github.com/{repo}",
        "",
        "Lead: akiibot · Finance/risk: Farid (@Alfa5nm) · Frontend: Wasik (@WasikZubair).",
        "",
        "Source: revised master implementation prompt PF-001..PF-032; PF-033 adds the explicit authenticated-session gate required by its security section.",
        "",
        "All feature issues depend on reviewed/merged PF-001..PF-005. Additional gates: PF-006/PF-013/PF-014/PF-018 require PF-033; PF-026 includes all UI/risk checks; PF-028 includes methodology. No cycles. Foundation implementation is not architecture approval.",
        "",
        "| ID | Owner | Dependencies | Status | GitHub |",
        "|---|---|---|---|---|",
    ]
    for row in rows:
        lines.append(
            f"| {row['id']} {row['title']} | {row['owner_display']} | {', '.join(row['dependencies']) or 'None'} | {row['status']} | {('[#' + str(row['number']) + '](' + row['url'] + ')') if row['url'] else 'PENDING_PUBLICATION'} |"
        )
    lines += [
        "",
        "## First parallel work after foundation review/merge",
        "",
        "- Lead: PF-033 and PF-012, then PF-013; PF-030 chain adapter can progress using isolated tests while funding is arranged.",
        "- Farid: PF-008 stresses and PF-017 planner; PF-006 activates after authentication lands, then PF-007/PF-009/PF-010.",
        "- Wasik: PF-018 dashboard, then each UI issue as its backend dependency merges.",
        "",
        "Do not unblock by closing issues without merged PR evidence. Add new remaining work as issues before implementing. See CONTRIBUTING.md for handoff and review rules.",
    ]
    (ROOT / "docs/ISSUE_BACKLOG.md").write_text("\n".join(lines) + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default="akiibot/proofFi")
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    rows = json.loads((ROOT / "docs/issues.json").read_text())
    if not args.publish:
        render_manifest(rows, args.repo)
        return
    gh("auth", "status")
    gh("repo", "view", args.repo, "--json", "nameWithOwner,viewerPermission")
    existing = json.loads(
        gh(
            "issue",
            "list",
            "--repo",
            args.repo,
            "--state",
            "all",
            "--limit",
            "1000",
            "--json",
            "number,title,url",
        )
    )
    mapping = {}
    for entry in existing:
        match = re.search(r"\bPF-\d{3}\b", entry["title"])
        if match:
            if match[0] in mapping:
                raise SystemExit(f"Duplicate issue ID {match[0]}: reconcile manually")
            mapping[match[0]] = entry
    labels = {label for row in rows for label in row["labels"]} | {
        "contract-change",
        "type:bug",
        "type:integration",
        "type:security",
        "priority:P2",
        "status:ready",
    }
    for label in sorted(labels):
        gh("label", "create", label, "--repo", args.repo, "--color", "0E8A80", "--force")
    for row in rows:
        entry = mapping.get(row["id"])
        if not entry:
            cmd = [
                "issue",
                "create",
                "--repo",
                args.repo,
                "--title",
                f"[{row['id']}] {row['title']}",
                "--body-file",
                f".github/issue-drafts/{row['id']}.md",
            ]
            for label in row["labels"]:
                cmd += ["--label", label]
            if row["github_assignee"]:
                cmd += ["--assignee", row["github_assignee"]]
            url = gh(*cmd)
            entry = {"url": url, "number": int(url.rsplit("/", 1)[-1])}
        row.update(url=entry["url"], number=entry["number"])
        (ROOT / "docs/issues.json").write_text(json.dumps(rows, indent=2) + "\n")
        render_manifest(rows, args.repo)
        print(row["id"], row["url"], flush=True)
    by_id = {row["id"]: row for row in rows}
    for row in rows:
        # Keep drafts as stable IDs; render GitHub references only into publication bodies.
        body = (ROOT / f".github/issue-drafts/{row['id']}.md").read_text()
        links = (
            "\n".join(
                f"- [{dep}]({by_id[dep]['url']}) (#{by_id[dep]['number']})"
                for dep in row["dependencies"]
            )
            or "None."
        )
        body += "\n## Published dependency links\n" + links + "\n"
        subprocess.run(
            ["gh", "issue", "edit", str(row["number"]), "--repo", args.repo, "--body-file", "-"],
            input=body,
            text=True,
            check=True,
            stdout=subprocess.DEVNULL,
        )
    render_manifest(rows, args.repo)


if __name__ == "__main__":
    main()
