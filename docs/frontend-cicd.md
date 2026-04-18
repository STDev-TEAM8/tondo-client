# Frontend CI/CD Guide

## Current target flow

1. Developer pushes a feature branch.
2. GitHub Actions runs `npm ci`, `npm run lint`, and `npm run build`.
3. A pull request is opened and the same checks run again.
4. The PR is merged into `main`.
5. Vercel detects the `main` update and creates a production deployment.
6. The production deployment should serve from `https://tondo-client.vercel.app`.

## What GitHub Actions does

- Workflow file: `.github/workflows/frontend-ci.yml`
- Trigger:
  - every pull request
  - every push to `main`
- Checks:
  - dependency install with `npm ci`
  - static lint with `npm run lint`
  - production build with `npm run build`

The workflow uses `VITE_API_BASE_URL=https://api.tondo.kr` during CI build validation so the production build shape matches the real deployment target.

## What Vercel does

Vercel is responsible for actual hosting and deployment. GitHub Actions in this repository only validates the frontend code. The public production URL is controlled by the Vercel project, not by the GitHub Actions workflow.

Required Vercel settings:

- Project: `tondo-client`
- Git repository: `STDev-TEAM8/tondo-client`
- Production branch: `main`
- Production environment variable:
  - `VITE_API_BASE_URL=https://api.tondo.kr`

## How to keep the production URL as `tondo-client.vercel.app`

To make `https://tondo-client.vercel.app` the stable frontend address, all of the following must be true:

1. The GitHub repository must be connected to the Vercel project `tondo-client`.
2. The Vercel project's production branch must be `main`.
3. The alias `tondo-client.vercel.app` must point to this same Vercel project.
4. No older deployment or different project can still hold that alias.

If a new deployment gets a URL like `tondo-client-theta.vercel.app`, that means the main production alias is still attached somewhere else and must be reassigned in Vercel.

## Team checklist

### Frontend team

- open PRs against `main`
- wait for GitHub Actions to pass
- merge only after checks succeed
- confirm Vercel preview deployment works for the PR
- confirm production deployment after merging

### Infra or frontend owner in Vercel

- connect the GitHub repository to the `tondo-client` project
- set `main` as the production branch
- ensure `tondo-client.vercel.app` is assigned to the project
- keep `VITE_API_BASE_URL` set in Vercel Production

### Backend team

- allow CORS origin `https://tondo-client.vercel.app`
- if preview testing is needed, decide whether preview domains are also allowed
- support:
  - `GET`
  - `POST`
  - `OPTIONS`
- allow headers:
  - `Content-Type`
  - `X-User-UUID`

## Note about current risk

The frontend sends `averageVolume` in `POST /api/v1/artworks`. The backend DTO currently appears to use `averageVolulme`, which is a mismatch that should be fixed before relying on production traffic.
