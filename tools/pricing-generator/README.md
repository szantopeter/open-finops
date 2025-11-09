# Pricing map generator

This small script fetches on‑demand prices from the AWS Pricing API and writes a normalized JSON map at `src/pricing/pricing_map.json`.

Prereqs
- Node.js 18+ (or LTS)
- AWS credentials available in environment or profile (the script calls AWS Pricing via the AWS SDK)

Install dependencies:

```bash
npm install
```

Run the generator with default parameters:

```bash
node scripts/generate-pricing.js
```

Run the generator with explicit parameters:

```bash
node scripts/generate-pricing.js --regions=us-east-1,eu-west-1 --instances=db.t3.medium,db.r5b.2xlarge --out=src/pricing/pricing_map.json --discount=14
```

Notes
- The script queries the AWS Pricing GetProducts API and attempts to extract an on‑demand hourly price for each instanceType + region. It writes the hourly and monthly (hourly*24*30) rates into the JSON.
- The generated JSON follows the app's expected shape: `{ metadata, currency, regions: { <region>: { instanceClasses: { <instanceType>: { sku, onDemand: {hourly, monthly}, savingsOptions } } } } }`.
- If you cannot use AWS credentials, you can build the JSON manually or import a vendor CSV and use the `--instances` and `--regions` lists to control which SKUs to fetch.

If you want, I can:
- Add a `--csv` input to convert a vendor pricing CSV into the same JSON format.
- Improve extraction to account for engine/OS/license when needed.
