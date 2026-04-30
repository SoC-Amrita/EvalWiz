# Security Policy

Thank you for helping keep EvalWiz safe. This project handles academic workflows and may be deployed with real student, faculty, assessment, and report data, so security reports are taken seriously.

## Supported Versions

EvalWiz is still pre-1.0. Security fixes are handled on the current `main` branch unless a maintainer explicitly announces a supported release branch.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| older commits / forks | No |

## Reporting A Vulnerability

Please do not open a public GitHub issue for a vulnerability if it includes exploit details, secrets, private data, or a working attack path.

Use GitHub private vulnerability reporting if it is enabled for the repository. If it is not available, contact the maintainer privately and include only enough detail to reproduce the issue safely.

Helpful report details:

- affected route, action, API, script, or dependency
- impact and who can trigger it
- safe reproduction steps
- expected behavior vs actual behavior
- relevant logs with secrets removed
- dependency advisory links, if applicable

Do not include:

- Supabase service-role keys
- database URLs or passwords
- auth tokens, cookies, or session values
- real student/faculty data
- generated reports containing private academic data

## Scope

In scope:

- authentication and session handling
- workspace/role authorization bypasses
- mentor/faculty/admin privilege escalation
- cross-workspace data leakage
- student, marks, grading, report, or audit-log data exposure
- unsafe Supabase service-role usage
- dependency vulnerabilities that affect the deployed app or build pipeline
- SQL injection, XSS, CSRF, path traversal, or insecure file/report handling

Out of scope:

- reports that require already-public information only
- missing security headers without a concrete exploit path
- denial-of-service reports that require unrealistic local access
- social engineering
- vulnerabilities caused only by leaked local `.env` files or intentionally disabled security settings

## Handling Expectations

The maintainer will try to acknowledge valid private reports promptly, reproduce the issue, patch it on a `fix/...` branch, and merge through the normal pull-request workflow.

Security fixes should include focused verification. When practical, add regression tests for authorization, data leakage, or input validation failures.

## Dependency Advisories

Dependabot findings should be handled with the smallest safe update. Avoid `npm audit fix --force` unless the breaking change has been reviewed and tested.

If a transitive dependency is flagged, prefer upgrading the owning direct dependency first. Use overrides only when the upstream package has no safe release path.

