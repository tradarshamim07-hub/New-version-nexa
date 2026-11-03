import { db } from './db.js';

export async function initReviews() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS product_reviews (
      id BIGSERIAL PRIMARY KEY,
      product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      reviewer_name TEXT NOT NULL,
      rating SMALLINT NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(order_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS idx_product_reviews_product_created
      ON product_reviews(product_id, created_at DESC);
  `);
}
