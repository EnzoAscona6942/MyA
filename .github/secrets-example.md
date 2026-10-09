# Secrets Configuration Guide

## Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions** in your GitHub repo.

| Secret Name | Value | How to Get |
|-------------|-------|------------|
| `VERCEL_TOKEN` | Vercel API Token | [Vercel Account Settings → Tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Vercel Organization ID | Run: `npx vercel whoami --json` or check Vercel dashboard URL: `vercel.com/{org-name}` |
| `VERCEL_PROJECT_ID` | Vercel Project ID | Get from Vercel dashboard → Project Settings |

## Required Vercel Environment Variables

In Vercel dashboard → Project → Settings → Environment Variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Your Prisma database URL | Format: `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Random 32+ character string | Generate with: `openssl rand -hex 32` |

## How to Generate Vercel Token

1. Go to [Vercel Account Settings](https://vercel.com/account/tokens)
2. Click "Create New Token"
3. Give it a name (e.g., "GitHub Actions CI/CD")
4. Select scopes (full access for deployments)
5. Copy the token (you'll only see it once!)

## How to Get Vercel Org/Project IDs

```bash
# Install Vercel CLI globally
npm i -g vercel

# Login and get info
vercel login
npx vercel link
npx vercel whoami --json
```

The JSON output contains `orgId` and `projectId`.

## GitHub Actions Workflow Example

Once secrets are configured, your deploy workflow will work automatically:

```yaml
# .github/workflows/deploy.yml (already exists)
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

## Local Development (.env)

Create `.env` files (DO NOT commit these):

```bash
# backend/.env
DATABASE_URL="postgresql://user:password@localhost:5432/mya_dev"
JWT_SECRET="your-dev-secret-here"
```

```bash
# frontend/.env
VITE_API_URL="http://localhost:3000/api"
```

## Verification Steps

After configuring secrets:
1. Push to a feature branch → CI should run
2. Create a PR → Vercel should create preview deployment
3. Merge to main → Vercel should deploy to production