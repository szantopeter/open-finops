# AWS RDS Reserved Instance Portfolio Optimiser

This repository is an Angular application that analyses an RDS Reserved Instance (RI) portfolio and shows what-if scenarios. The production deployment is available at:

- Deployed site: `https://aws-rds-ri-portfolio-optimiser.dev.aws.wfscorp.com/`

**Quick Start**
- **Install dependencies:**

```zsh
npm install
```

- **Run in development:**

```zsh
# runs an Angular dev server at http://localhost:4200
npm start
```

- **Build (production):**

```zsh
npm run prod
```

**Tests & Type-checking**
- **Run unit tests (interactive / default):**

```zsh
npm test
```

- **Run unit tests once (CI style, headless):**

```zsh
ng test --watch=false --browsers=ChromeHeadless
```

- **TypeScript compile check (no emit):**

```zsh
npx tsc -p tsconfig.json --noEmit
```

**Linting**
- **Run linter:**

```zsh
npm run lint
```

**Important Configuration Notes**
- **Pricing metadata** The application needs pricing metadata from AWS. This is a static information therefore it is downloaded and stored in the git repo under **`src/assets/pricing`** . To regenerate these files see the pricing generator at **`tools/pricing-generator`** .  

- **Browser for tests:** the headless tests run with ChromeHeadless. Ensure Chrome is available on your machine when running `ng test --browsers=ChromeHeadless`.

**Project Layout (high level)**
- **`src/app/components/`**: UI components
- **`src/app/calculators/`**: pure business logic (cost timeseries, comparison, projections)
- **`src/app/services/`**: Angular services (HTTP, data access)
- **`assets/pricing/`**: static pricing JSON files used by the calculators
- **`AGENTS.md`**: guiding principles for AI Agents and humans