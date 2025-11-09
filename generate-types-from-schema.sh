#!/bin/bash

SCHEMA_FILE="./src/graphql/schema.graphqls"

# Fetch the supergraph schema and save to a temporary file
rover supergraph fetch World-Graph@dev > "$SCHEMA_FILE"

# Run graphql-codegen
npx graphql-codegen --config codegen.ts --schema "$SCHEMA_FILE" --output graphql/generated.ts

# Cleanup the temporary schema file
rm "$SCHEMA_FILE"

echo "GraphQL code generation completed successfully and saved in graphql/generated.ts."