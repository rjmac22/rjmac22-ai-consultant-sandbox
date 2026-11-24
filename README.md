# Poker Probability Utilities

A small, **synthetic** Python project used to test peer review of mathematical and programming changes.

- Uses no real poker hand histories, proprietary solver code, credentials or cloud services.
- Runs entirely with Python's standard library; there are **no GitHub Actions**.
- Changes should be reviewed as pull requests and **must not be merged or deployed without the repository owner's approval**.
- See [AGENTS.md](AGENTS.md) for review-only operating rules.

## Test locally

```bash
python3 -m unittest discover -s tests -v
```

No packaging, downloads or network access are needed.
