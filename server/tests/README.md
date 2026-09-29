# Backend test suite

Run the database-independent contract tests with:

```bash
npm test --prefix server
```

The suite starts the Express application on an ephemeral local port and validates the health endpoint, common error envelope, and request validation without connecting to MongoDB.

Add database-backed integration tests beside `api.contract.test.js`. Such tests should use a dedicated test database, apply migrations before execution, and clean up only records they create.
