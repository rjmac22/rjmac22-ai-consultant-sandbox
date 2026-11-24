# Consultant operating instructions — isolated test repository

This is a **public synthetic code-review fixture**. It is not the real poker solver, and it contains no personal data, secrets or production infrastructure.

**Review-only by default:** inspect files, run bounded local tests without external network use, challenge assumptions and post comments. Do not push commits, merge, enable GitHub Actions, configure credentials, deploy, or change settings without the owner's explicit permission for that specific operation. No AI's review counts as the owner's approval.

If you review a PR, verify the mathematics independently instead of trusting a passing test suite. State exact files/lines, reproduction or counterexample and uncertainty. If something looks correct, say so rather than inventing defects. All changes require a separate owner-reviewed PR and an owner-approved merge.

The main project operating rules are in the private central repository `rjmac22/distributed-research-network`, in `AI-READ-FIRST.md`, `docs/REVIEW-GATE.md` and `docs/AGENT-EXCHANGE.md`; a reviewer without access must still respect the rules in this local file. The sandbox must not be connected to live services or used to execute remotely supplied code.
