# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report them privately via [GitHub's private vulnerability reporting](../../security/advisories/new) or by emailing the maintainer directly.

Include:
- A description of the vulnerability and its potential impact
- Steps to reproduce
- Any suggested mitigations

You can expect an acknowledgement within 72 hours and a resolution timeline once the issue is confirmed.

## Scope

This project is a developer tool intended to be run locally or in a trusted internal network. The primary attack surface is:

- The Go backend HTTP API (unauthenticated by design — do not expose it publicly)
- Proto/reflection input parsing
- Variable interpolation in request payloads
