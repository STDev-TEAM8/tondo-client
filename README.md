# tondo-client

STDev 8 Team frontend repository built with React and Vite.

## Scripts

- `npm run dev`: start local Vite dev server
- `npm run lint`: run ESLint
- `npm run build`: create production build
- `npm run preview`: preview the built app locally

## Deployment

- Hosting: Vercel
- Production API env: `VITE_API_BASE_URL`
- SPA routing: handled by `vercel.json` rewrite for `BrowserRouter`

See deployment details in [docs/vercel-deployment-guide.md](./docs/vercel-deployment-guide.md).

## CI/CD

GitHub Actions validates pull requests and pushes to `main` with lint and build checks. Vercel is expected to handle preview and production deployments after the GitHub repository is connected to the `tondo-client` project.

See CI/CD setup notes in [docs/frontend-cicd.md](./docs/frontend-cicd.md).
