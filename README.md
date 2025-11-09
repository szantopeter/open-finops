# AngularTemplate

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 15.1.5.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## GraphQL Codegen

### Generating types from GraphQL schema [(docs)](https://wfscorp.atlassian.net/wiki/spaces/APIS/pages/3727458333/GraphQL+Code+Gen+for+Angular+UI+Consumers#%F0%9F%92%BB-Generating-types-from-schema-for-local-development)

1. Add each GraphQL operation your app uses as a file in `/src/graphql/documents`.
2. Generate a personal API key from Apollo studio [Apollo Personal API Keys](https://www.apollographql.com/docs/graphos/platform/access-management/api-keys#personal-api-keys).
3. Install Rover CLI on your machine by running `npm install -g @apollo/rover`.
4. Authenticate with Rover CLI by running `rover config auth` and enter your personal API key from step 2 when prompted.
5. Give the script execution permission by running `chmod +x generate-types-from-schema.sh`.
6. Run `./generate-types-from-schema.sh` or `npm run generate` to generate TS types from GraphQL Dev schema.

### Using generated types in GraphQL operations [(docs)](https://wfscorp.atlassian.net/wiki/spaces/APIS/pages/3727458333/GraphQL+Code+Gen+for+Angular+UI+Consumers#%3Agraphql%3A-Using-generated-types-to-make-type-safe-GQL-operations)

1. Import the required types from `generated.ts` into your service file(s).
2. Pass the GQL types into your constructor.
3. Call `.fetch` or `.mutate` on the GQL types to make the operation.

### GraphQL Codegen in Dynamic Pipelines [(docs)](https://wfscorp.atlassian.net/wiki/spaces/APIS/pages/3727458333/GraphQL+Code+Gen+for+Angular+UI+Consumers#%3Abitbucket%3A--Type-validation-during-CI%2FCD-build-and-deploy-with-Dynamic-Pipelines)

1. As part of the Angular UI Bitbucket dynamic pipeline, during the build stage, a new `generated.ts` file will be generated from the Dev supergraph schema and compiled with your code. `generated.ts` is then included in the build artifacts.
2. For this reason, it is recommended to not track `generated.ts` since it will be replaced during CI/CD build.
3. Before each deployment, a new `generated.ts` file will be generated from the supergraph schema for the environment you are deploying to, and compiled with your code. This will identify if any schema types your code requires are missing in the environment you are deploying to.
4. To opt out, pass `excludeValidateSchemaStep: true` in your bitbucket-pipelines.yml.

### GraphQL Codegen folder structure and packages

The following files were added for GraphQL codegen
- `codegen.ts`
- `generate-types-from-schema.sh`
- `src/graphql/documents/**`

The following packages were added for GraphQL codegen
- `@graphql-codegen/cli`
- `@graphql-codegen/typescript`
- `@graphql-codegen/typescript-apollo-angular`
- `@graphql-codegen/typescript-operations`

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
