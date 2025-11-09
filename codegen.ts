import type { CodegenConfig } from '@graphql-codegen/cli'
const config: CodegenConfig = {
  schema: './src/graphql/schema.graphqls',
  documents: './src/**/*.graphql',
  generates: {
    './graphql/generated.ts': {
      plugins: ['typescript', 'typescript-operations', 'typescript-apollo-angular']
    }
  }
}
export default config