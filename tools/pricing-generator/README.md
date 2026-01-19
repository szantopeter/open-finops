
# pricing-generator

A standalone TypeScript CLI that generates pricing files by reading the AWS API

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
## Generate pricing files only needed by a given RDS input csv file

```bash
npm start -- -csv one-line-example.csv
```
