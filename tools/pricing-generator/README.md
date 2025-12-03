# Pricing map generator

This script fetches prices from the AWS Pricing API and writes a normalized JSON map at `src/assets/pricing`

## Prerequisites
- Node.js 18+ (or LTS)
- AWS credentials available in environment or profile (the script calls AWS Pricing via the AWS SDK). Run

```bash
aws configure sso
```

## Install dependencies:
```bash
npm install
```

## Run the generator with the included shell wrapper that sets up node invocation and AWS SSO authentication

```bash
cd tools/pricing-generator
./generate-pricing.sh -csv ../assets/cloudability-rds-reservations.csv
```