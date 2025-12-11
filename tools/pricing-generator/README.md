
# pricing-generator

A standalone TypeScript CLI that generates pricing files

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

## Run the tool with default settings

```bash
npm start
```
## Run the tool with parameters

```bash
npm start -- -csv cloudability-one-line.csv
```
