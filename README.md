# Open FinOps : OpenSource FinOps

This is an opensource FinOps application that offers multiple cloud cost reduction options. For now in it's initial state in covers these areas

- AWS RDS Savings Plan optimisation : It inspects all the AWS RDS Savings plans and makes recommendation on how would different upfront payment and duration options impact the cost
- AWS RDS portfolio analysis : Some RDS instance classes have lower cost for newer generations. The tool will check the current RDS portfolio and identify items that would be cheaper if it would be upgraded


# Privacy, how is your data handled?

This applicaiton is frontend only, all the calculations are made in the browser, data is only stored in browser local storage (IndexedDB). 
- **This tool does't** directly access cloud provider (data needs to be exported from cloud and imported here)
- **This tool doesn't** share any data with any service or 3rd party (you can see all broswer interactions in your browser's network tab)

# How to use this tool?
## Access the hosted page on GitHub Pages
[GitHub Pages Hosted](https://szantopeter.github.io/open-finops/)

## Self hosted locally
See instructions below on building the tool

## How get a data export data from AWS?
- If you have a cost management platform you can get the data out of it.
- Cou can extract it manually
- You can use a script 

# Building the tool

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
- **Pricing metadata** The application needs pricing metadata from AWS. This is a static information already downloaded and stored in the git repo under **`src/assets/pricing`**. To regenerate these files see the pricing generator at **`tools/pricing-generator`** .  

- **Browser for tests:** the headless tests run with ChromeHeadless. Ensure Chrome is available on your machine when running `ng test --browsers=ChromeHeadless`.

**Project Layout (high level)**
- **`src/app/components/`**: UI components
- **`src/app/calculators/`**: pure business logic (cost timeseries, comparison, projections)
- **`src/app/services/`**: Angular services (HTTP, data access)
- **`assets/pricing/`**: static pricing JSON files used by the calculators
- **`AGENTS.md`**: guiding principles for AI Agents and humans