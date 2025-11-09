# About this project
The purpose of this project is to analyse current AWS RDS Reserved Instance portoflio and show what-if scenarios explaining how different reserved instances would affect the overall cost. Any reference to RI means reserved instance

## Data sources
- RDS RI portfolio RDS comes from cloudability as a csv export. The stucture of the csv is fixed and can't be modified. 
- AWS RDS pricing data will be downloaded by the pricing-generator tool that has to be run manually. 

## Business logic
- RIs have to be matched by the appropriate pricing category, by all of the following fields : instance class, region, multi AZ, engine, edition, upfront payment, duration. 
- Pricing data must be read from static files under assets/pricing . The file name contains the 
- To calculate the monthly RI cost the logic is this
	1. Match every RI with the pricing data
	1. Calculte how many days in the given month the RI was active
	1. Multiply the daily cost of the appropriate savings plan with the number of active days in the month
- To calculate how much would it cost to run without RI you have to follow similar logic as above
	1. Match every RI with the pricing data
	1. Calculte how many days in the given month the RI was active
	1. Multiply the daily on demand price with the number of active days in the month
- For every calculation keep in mind that a single row in the RI input might cover multiple RIs as indicated by the count field

# Tech standards
Use these tools and technologies

## Frontend
### Frontend tech standards
- Use the the UI components defined in the reuse-angular-ui project
- Angular 20+
- TypeScript 5.8+ with strict mode enabled
- Tailwind CSS for styling
- SCSS for component-specific styles
- Apollo Angular for GraphQL client
- Auth0 Angular for authentication
- RxJS for reactive programming
- Jasmine and Karma for unit testing
- ESLint with @wk/eslint-config for code linting
- GraphQL Code Generator for type-safe GraphQL operations
- Husky for Git hooks

### Frontend coding standards
- Business logic has to be clearly separated from UI specific details 
Always follow clean code best practices
- Create components by business functionality, not by technical layers. For example instead of creating folders like `shared/components`, `shared/services`, create feature-based modules like `order-management/`, `tracking/`, etc. and put all relevant components, services, and models there
- Always use constructor injection for services, avoid property injection
- Use TypeScript 5.8+ language features and maintain strict type safety
- Prefer standalone components over NgModules for new development
- Use OnPush change detection strategy where possible for performance
- Implement proper lazy loading for feature modules and components
- Use reactive patterns with RxJS observables, avoid imperative subscriptions where possible
- Always unsubscribe from observables to prevent memory leaks (use `takeUntil`, `async` pipe, or `DestroyRef`)
- Use Angular's built-in async pipe in templates instead of manual subscription
- Optimize for readability and maintainability, but keep performance in mind
- Use proper TypeScript access modifiers (private, protected, public)
- Follow Angular style guide naming conventions (kebab-case for selectors, camelCase for properties)
- Use environment-specific configurations for different deployment targets
- Implement proper error handling and user feedback mechanisms

### Frontend testing standards
- Business logica has to be 100% tested with positive and negative tests 
Maintain minimum 80% code coverage for all components and services
- Write unit tests for all business logic and service methods
- Use TestBed for component testing with proper mocking of dependencies
- Test both happy path and error scenarios
- Mock external dependencies (HTTP calls, Auth0, etc.) in unit tests
- Use descriptive test names that explain the expected behavior
- Group related tests using describe blocks
- Use beforeEach for common test setup
- Test user interactions and component outputs
- Verify template rendering and data binding
- Use Page Object Model pattern for complex component testing
- Run tests in CI/CD pipeline with headless Chrome
- Generate coverage reports and fail builds if coverage falls below threshold