import pg from 'pg';
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing. Add your hosted PostgreSQL connection string in the hosting environment.');
}

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
  max: Number(process.env.PGPOOL_MAX || 5),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

export async function initDb() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id BIGSERIAL PRIMARY KEY,
      admin_id BIGINT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      token_hash CHAR(64) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON admin_sessions(expires_at);
    CREATE TABLE IF NOT EXISTS products (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      description TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL CHECK(price >= 0),
      compare_price INTEGER,
      stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
      image_url TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      order_code TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      subtotal INTEGER NOT NULL,
      delivery_fee INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      order_status TEXT NOT NULL DEFAULT 'pending',
      courier TEXT,
      tracking_code TEXT,
      courier_status TEXT,
      gateway_transaction_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id BIGINT NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      line_total INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS payment_events (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT REFERENCES orders(id),
      provider TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS stock_movements (
      id BIGSERIAL PRIMARY KEY,
      product_id BIGINT NOT NULL REFERENCES products(id),
      order_id BIGINT,
      quantity_change INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS courier_events (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id),
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Always make sure the starter database has a useful catalog. Existing products are preserved.
  const count = await db.query('SELECT COUNT(*)::int AS n FROM products');
  const existing = count.rows[0].n;
  if (existing < 150) {
    const catalog = [
      ['Fashion','T-Shirt',450],['Fashion','Polo Shirt',520],['Fashion','Casual Shirt',650],['Fashion','Denim Jeans',950],['Fashion','Slim Fit Jeans',1050],['Fashion','Cotton Panjabi',850],['Fashion','Traditional Panjabi',950],['Fashion','Hoodie',850],['Fashion','Sweatshirt',780],['Fashion','Track Pants',550],['Fashion','Cargo Pants',750],['Fashion','Formal Trousers',700],['Fashion','Summer Shorts',420],['Fashion','Casual Kurta',720],['Fashion','Linen Shirt',820],['Fashion','Oversized T-Shirt',480],['Fashion','Sports Jersey',650],['Fashion','Light Jacket',1100],['Fashion','Rain Jacket',1250],['Fashion','Winter Sweater',980],
      ['Footwear','Casual Sneakers',950],['Footwear','Running Shoes',1250],['Footwear','Walking Shoes',1100],['Footwear','Canvas Shoes',750],['Footwear','Loafers',1050],['Footwear','Formal Shoes',1250],['Footwear','Sports Sandals',650],['Footwear','Casual Sandals',520],['Footwear','Flip Flops',250],['Footwear','Slip-On Shoes',850],
      ['Accessories','Leather Belt',450],['Accessories','Classic Wallet',380],['Accessories','Card Holder',280],['Accessories','Cap',250],['Accessories','Classic Sunglasses',550],['Accessories','Sports Sunglasses',650],['Accessories','Analog Watch',850],['Accessories','Digital Watch',650],['Accessories','Travel Pouch',320],['Accessories','Key Holder',180],
      ['Bags','Minimalist Backpack',850],['Bags','Everyday Backpack',650],['Bags','Laptop Backpack',1250],['Bags','Travel Backpack',1450],['Bags','School Backpack',750],['Bags','Canvas Tote Bag',350],['Bags','Crossbody Bag',550],['Bags','Waist Bag',420],['Bags','Duffel Bag',950],['Bags','Travel Organizer',450],
      ['Electronics','Smart Watch',1999],['Electronics','Wireless Earbuds',1250],['Electronics','Bluetooth Speaker',950],['Electronics','Portable Speaker Mini',750],['Electronics','USB-C Charger',450],['Electronics','Fast Charger 20W',650],['Electronics','Fast Charger 33W',850],['Electronics','USB-C Cable',250],['Electronics','Lightning Cable',280],['Electronics','Power Bank 10000mAh',950],['Electronics','Power Bank 20000mAh',1450],['Electronics','Wireless Mouse',550],['Electronics','Wireless Keyboard',950],['Electronics','Gaming Mouse',850],['Electronics','Laptop Stand',750],['Electronics','Phone Stand',250],['Electronics','Ring Light Mini',550],['Electronics','LED Strip Light',550],['Electronics','Mini Projector',4500],['Electronics','Webcam HD',1450],['Electronics','USB Microphone',1250],['Electronics','Gaming Headset',1450],['Electronics','HDMI Cable',350],['Electronics','USB Flash Drive 64GB',650],['Electronics','USB Flash Drive 128GB',950],['Electronics','Extension Board',650],['Electronics','Smart Plug',850],['Electronics','Mini Fan',650],['Electronics','Rechargeable Fan',1850],
      ['Home & Living','Desk Lamp',590],['Home & Living','LED Desk Lamp',750],['Home & Living','Night Lamp',450],['Home & Living','Study Lamp',650],['Home & Living','Table Clock',450],['Home & Living','Wall Clock',750],['Home & Living','Digital Alarm Clock',650],['Home & Living','Storage Box Small',250],['Home & Living','Storage Box Large',450],['Home & Living','Laundry Basket',550],['Home & Living','Water Bottle 750ml',350],['Home & Living','Thermal Bottle',850],['Home & Living','Coffee Mug',250],['Home & Living','Ceramic Mug Set',550],['Home & Living','Glass Tumbler',280],['Home & Living','Lunch Box',450],['Home & Living','Kitchen Organizer',650],['Home & Living','Spice Rack',750],['Home & Living','Cutlery Set',850],['Home & Living','Nonstick Pan',950],['Home & Living','Frying Pan',850],['Home & Living','Water Jug',550],['Home & Living','Bedsheet Set',950],['Home & Living','Pillow Cover Set',450],['Home & Living','Cushion Cover',250],['Home & Living','Door Mat',450],['Home & Living','Bathroom Mat',520],['Home & Living','Hand Towel',250],['Home & Living','Bath Towel',550],
      ['Automotive','Car Cleaning Cloth',350],['Automotive','Car Phone Holder',550],['Automotive','Car Air Freshener',250],['Automotive','Car Charging Adapter',650],['Automotive','Bike Phone Holder',450],['Automotive','Bike LED Light',550],['Automotive','Tire Pressure Gauge',650],['Automotive','Car Cleaning Brush',300],['Automotive','Dashboard Mat',350],['Automotive','Seat Belt Cover',250],
      ['Kids','Kids T-Shirt',350],['Kids','Kids Polo Shirt',420],['Kids','Kids Jeans',550],['Kids','Kids Hoodie',650],['Kids','Kids Sneakers',750],['Kids','Kids Sandals',450],['Kids','School Lunch Bag',450],['Kids','Kids Water Bottle',350],['Kids','Coloring Book',180],['Kids','Building Blocks Set',650],['Kids','Puzzle Game',450],['Kids','Drawing Set',350],['Kids','Baby Blanket',750],['Kids','Baby Feeding Bowl',280],['Kids','Baby Bib Set',250],
      ['Stationery','Notebook A5',120],['Stationery','Notebook A4',180],['Stationery','Premium Diary',350],['Stationery','Ball Pen Set',120],['Stationery','Gel Pen Set',150],['Stationery','Marker Set',250],['Stationery','Highlighter Set',220],['Stationery','Pencil Set',100],['Stationery','Geometry Box',250],['Stationery','Desk Organizer',350],['Stationery','Sticky Notes Set',150],['Stationery','File Folder',120],['Stationery','Document Bag',250],['Stationery','Calculator',350],['Stationery','Sketch Pen Set',280],
      ['Mobile Accessories','Phone Case',250],['Mobile Accessories','Premium Phone Case',450],['Mobile Accessories','Screen Protector',180],['Mobile Accessories','Camera Lens Protector',220],['Mobile Accessories','Phone Ring Holder',150],['Mobile Accessories','Phone Grip',180],['Mobile Accessories','Car Charger',450],['Mobile Accessories','Wireless Charging Pad',850],['Mobile Accessories','Mobile Tripod',650],['Mobile Accessories','Selfie Stick',450],['Mobile Accessories','Earphone Case',220],['Mobile Accessories','Cable Organizer',150],['Mobile Accessories','USB Hub',650],['Mobile Accessories','OTG Adapter',180],['Mobile Accessories','Memory Card Reader',350],['Mobile Accessories','Bluetooth Receiver',450]
    ];

    const needed = 150 - existing;
    for (const [category, name, price] of catalog.slice(0, needed)) {
      const comparePrice = Math.round(price * 1.25);
      const stock = 10 + (name.length % 16);
      await db.query(
        'INSERT INTO products(name,category,description,price,compare_price,stock,image_url) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [name, category, `ShopNexa demo product: ${name}. Replace with supplier-verified details and a real product image before selling.`, price, comparePrice, stock, '']
      );
    }
    console.log(`ShopNexa catalog ready: ${Math.min(150, existing + needed)} products`);
  }
}
