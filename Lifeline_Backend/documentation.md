# DOCUMENTATION

## PRE-REQUISITES

1. Bun package manager
1. Better-Auth
1. PostgreSQL
4. lifeline user and database
5. Commands to use:

> CREATE SCHEMA IF NOT EXISTS auth;
> GRANT ALL PRIVILEGES ON SCHEMA auth TO lifeline;
> GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO lifeline;
> ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO lifeline;
> pnpm dlx @better-auth/cli@latest generate
> pnpm dlx @better-auth/cli@latest migrate
