# Vercel Deployment Guide

## 1. Current architecture

- Frontend: Vite SPA deployed to Vercel
- Backend API: AWS EC2 server
- API call path: user's browser -> EC2 API directly

This project does **not** call the API through a Vercel Serverless Function or Edge Function.

## 2. Client developer should know

### Required environment variable

- `VITE_API_BASE_URL`
  - Example: `https://api.example.com`
  - Purpose: frontend base URL for the EC2 API
  - Vercel location: Project Settings -> Environment Variables

If `VITE_API_BASE_URL` is empty, this app runs in mock mode.

### API endpoints currently used by the frontend

- `POST /api/v1/auth/signup`
- `POST /api/v1/artworks`
- `GET /api/v1/artworks/:taskId`
- `GET /api/v1/artworks/:taskId/stream` (SSE)

### Request details the backend must match

- `POST /api/v1/auth/signup`
  - Header: `Content-Type: application/json`
  - Body:

```json
{
  "username": "name",
  "password": "password"
}
```

- `POST /api/v1/artworks`
  - Header: `Content-Type: application/json`
  - Body:

```json
{
  "uuid": "browser-session-uuid",
  "averageHz": 123.4,
  "averageVolume": 0.12,
  "averageTimbre": 456.7,
  "voiceColor": "string",
  "base64Image": "base64-without-data-url-prefix"
}
```

- `GET /api/v1/artworks/:taskId`
  - Header: `X-User-UUID: <uuid>`
  - Expected response shape:

```json
{
  "imageUrl": "https://...",
  "report": "docent text"
}
```

- `GET /api/v1/artworks/:taskId/stream`
  - Transport: `EventSource` / `text/event-stream`
  - Expected event name: `progress`
  - Expected event data example:

```json
{
  "progress": 50,
  "status": "AI 렌더링 중"
}
```

### Vercel routing note

This app uses `BrowserRouter`, so direct access to routes like `/visualizer` or `/result/:taskId` must be rewritten to `index.html`. The repository includes `vercel.json` for that.

## 3. Server developer should know

### CORS must allow the Vercel frontend origin

Because the browser calls EC2 directly, CORS must be configured on the API server.

Allow at least:

- Origins:
  - production Vercel domain, for example `https://your-project.vercel.app`
  - custom production domain if used, for example `https://app.example.com`
  - preview domains too, if preview deployments need to access the API

- Methods:
  - `GET`
  - `POST`
  - `OPTIONS`

- Headers:
  - `Content-Type`
  - `X-User-UUID`

### SSE requirements

- Response header should include `Content-Type: text/event-stream`
- Disable buffering if a proxy/load balancer sits in front of the app
- Keep the connection open until completion
- Send `progress` events with JSON payloads

### Security group note that is easy to miss

Since API requests come from the **user's browser**, EC2 inbound rules cannot practically whitelist "only Vercel" IPs for this frontend-to-API traffic.

In other words:

- Static assets are served by Vercel
- API requests are sent from end-user networks, not from fixed Vercel server IPs

So if the API stays directly public to the browser, the security group usually needs public inbound access on the API port behind HTTPS, typically through:

- `443` from `0.0.0.0/0`
- optionally `80` only for redirect to `443`

If the team wants to restrict API access to Vercel-only infrastructure, the architecture must change to one of these:

- frontend -> Vercel server function -> EC2
- frontend -> API Gateway / ALB / reverse proxy with additional auth controls
- private backend with a separate public proxy layer

### Recommended production setup

- Serve the API through HTTPS with a stable domain such as `https://api.example.com`
- Attach a domain and TLS certificate before setting `VITE_API_BASE_URL`
- If using Nginx or ALB in front of EC2, verify SSE is supported without buffering or timeout issues

## 4. Deployment handoff checklist

### Client developer

- Set `VITE_API_BASE_URL` in Vercel production environment variables
- Confirm the final frontend production domain
- Share the production domain with the server developer for CORS allowlist
- Verify SPA routes work after deployment
- Verify signup, artwork creation, result fetch, and SSE progress flow in production

### Server developer

- Add the final Vercel production domain to CORS allowlist
- Add preview domains too if preview testing is needed
- Ensure `OPTIONS` preflight is handled correctly
- Ensure `X-User-UUID` is allowed in CORS request headers
- Ensure SSE endpoint returns `progress` events in the expected format
- Confirm HTTPS endpoint and domain to the client developer

## 5. Suggested values to exchange after deployment

### Server developer -> client developer

- API base URL, for example `https://api.example.com`
- whether preview domains are allowed
- any rate limit, auth rule, or request size limit that affects image upload
- SSE timeout or connection limits if any

### Client developer -> server developer

- Vercel production domain
- custom frontend domain if used
- whether preview deployments also need API access
- final list of browser routes to test in production
