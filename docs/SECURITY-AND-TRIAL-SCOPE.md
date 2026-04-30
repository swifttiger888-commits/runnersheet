# Security and Trial Scope

## Trial scope

RunnerSheet is currently operated as a controlled trial.

- It is not a full replacement for existing branch folder process until approved by branch management.
- Manager usage is intended for workplace PCs.
- Driver usage is primarily personal mobile devices.

## Access controls

- Firebase Auth for user identity.
- Firestore user profile controls role and access status.
- Role-based route boundaries for driver, manager, and admin flows.

## Transport security

- HTTPS is enforced with canonical redirects.
- HSTS header is set to require secure transport.
- `www` host is redirected to canonical apex host.

## Data handling posture

- Journey and profile data are stored in Firebase/Firestore.
- Manager search and reporting are role-gated.
- Correction actions maintain audit context.

## Operational expectations during trial

- Use least-privilege account setup.
- Restrict manager access to approved devices/accounts.
- Record issues and review before wider rollout.

## Review checklist before wider adoption

- Role and approval workflow signed off
- Domain allowlist validated on workplace network
- Smoke tests passing for manager critical paths
- Branch policy approval confirmed
