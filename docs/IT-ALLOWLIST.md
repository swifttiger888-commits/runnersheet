# RunnerSheet IT Allowlist

Use this list when workplace networks enforce strict outbound filtering.

## Manager workplace PCs (required)

- `runnersheet.win`
- `www.runnersheet.win`
- `*.googleapis.com`
- `*.gstatic.com`
- `accounts.google.com`
- `api.deepseek.com` (only if manager AI search is enabled)

## Optional (feature-dependent)

- `api.postcodes.io` (postcode lookup workflows)
- `driver-vehicle-licensing.api.gov.uk` (DVLA checks; mainly driver flow)

## Notes for network/security teams

- Keep HTTPS/TLS inspection compatible with Firebase API flows.
- Allow modern HTTP/2 and secure Web transport behavior used by browser APIs.
- Validate Google sign-in popup flow from manager desktops.

## Validation steps

1. Open `https://runnersheet.win` from workplace PC.
2. Sign in with approved manager account.
3. Open manager journeys and reports.
4. If enabled, run manager AI search.
5. Confirm no blocked-domain or certificate warnings.
