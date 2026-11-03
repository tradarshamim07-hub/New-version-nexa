# ShopNexa — Fresh Start

A clean storefront foundation using the existing PostgreSQL schema and API routes. The database and order records are preserved; this project does not drop or reset tables.

## Deploy
1. Keep a backup of the current GitHub repository.
2. Upload/replace the project files in the existing repository on `main`.
3. Keep the existing Render PostgreSQL database and `DATABASE_URL`. Do not create a new database or run destructive migrations.
4. Ensure `NODE_ENV=production`, `DATABASE_URL`, and the existing admin environment values are configured in Render.
5. Deploy latest commit.

## Verify after deployment
- `/api/health` returns `{ "ok": true }`
- Homepage loads and product catalog appears
- Search/category/sort work
- Add to bag, quantity, checkout COD and tracking work
- Admin login and management should be tested separately

Product catalog rows are demo content. Verify supplier details, pricing, stock, and product images before accepting real customer orders. SSLCommerz requires valid merchant credentials and provider configuration.
