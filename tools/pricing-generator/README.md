
# pricing-generator

A standalone TypeScript CLI that calls an AWS API using the first profile from your AWS configuration.

## Requirements

- Node.js >= 14
- npm
- AWS CLI configured with profiles (run `aws configure sso` or `aws configure` if needed)
- Valid AWS credentials (run `aws sso login` if using SSO)

## Install & build

```bash
npm install
npm run build
```

## Run the tool

```bash
npm start
```

## What it does

- Loads the first AWS profile from `~/.aws/config`
- Uses AWS STS `GetCallerIdentity` to prove API access
- Prints account ID, user ID, and ARN on success

## Notes

- If credentials are expired (e.g., SSO), run `aws sso login --profile <profile-name>`
