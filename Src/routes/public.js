import { Router } from 'express';
import { db } from '../db.js';
import { bdPhone, cleanText, orderCode } from '../utils.js';
export const publicRouter = Router();

export async function ensureProductCatalog() {
  const count = await db.query('SELECT COUNT(*)::int AS n FROM products');
  const existing = count.rows[0].n;
  if (existing >= 150) return existing;

  const catalog = [
    ['Premium T-Shirt','Fashion',450,600,20], ['Classic Polo Shirt','Fashion',520,700,18], ['Casual Shirt','Fashion',650,850,16],
    ['Denim Jeans','Fashion',950,1200,14], ['Slim Fit Jeans','Fashion',1050,1350,12], ['Cotton Panjabi','Fashion',850,1100,15],
    ['Traditional Panjabi','Fashion',950,1250,13], ['Hoodie','Fashion',850,1100,16], ['Pullover Sweatshirt','Fashion',780,1000,17],
    ['Basic Track Pants','Fashion',550,750,20], ['Cargo Pants','Fashion',750,950,14], ['Formal Trousers','Fashion',700,900,15],
    ['Summer Shorts','Fashion',420,550,22], ['Casual Kurta','Fashion',720,950,13], ['Linen Shirt','Fashion',820,1050,11],
    ['Oversized T-Shirt','Fashion',480,650,20], ['Sports Jersey','Fashion',650,850,18], ['Light Jacket','Fashion',1100,1450,10],
    ['Rain Jacket','Fashion',1250,1600,9], ['Winter Sweater','Fashion',980,1250,12], ['Casual Sneakers','Footwear',950,1250,12],
    ['Running Shoes','Footwear',1250,1600,10], ['Walking Shoes','Footwear',1100,1450,12], ['Canvas Shoes','Footwear',750,950,16],
    ['Classic Loafers','Footwear',1050,1350,10], ['Formal Shoes','Footwear',1250,1650,9], ['Sports Sandals','Footwear',650,850,14],
    ['Casual Sandals','Footwear',520,700,18], ['Flip Flops','Footwear',250,350,25], ['Leather Belt','Accessories',450,600,20],
    ['Classic Wallet','Accessories',380,500,22], ['Card Holder','Accessories',280,400,24], ['Cap','Accessories',250,350,20],
    ['Classic Sunglasses','Accessories',550,750,14], ['Sports Sunglasses','Accessories',650,850,12], ['Analog Watch','Accessories',850,1100,12],
    ['Digital Watch','Accessories',650,900,15], ['Travel Pouch','Accessories',320,450,20], ['Key Holder','Accessories',180,250,25],
    ['Minimalist Backpack','Bags',850,1100,15], ['Everyday Backpack','Bags',650,800,15], ['Laptop Backpack','Bags',1250,1600,10],
    ['Travel Backpack','Bags',1450,1850,9], ['School Backpack','Bags',750,950,14], ['Canvas Tote Bag','Bags',350,500,20],
    ['Crossbody Bag','Bags',550,750,16], ['Waist Bag','Bags',420,550,18], ['Duffel Bag','Bags',950,1250,11],
    ['Travel Organizer','Bags',450,600,16], ['Smart Watch','Electronics',1999,2499,8], ['Wireless Earbuds','Electronics',1250,1600,10],
    ['Bluetooth Speaker','Electronics',950,1250,12], ['Portable Speaker Mini','Electronics',750,950,14], ['USB-C Charger','Electronics',450,600,18],
    ['Fast Charger 20W','Electronics',650,850,16], ['Fast Charger 33W','Electronics',850,1100,14], ['USB-C Cable','Electronics',250,350,25],
    ['Lightning Cable','Electronics',280,400,20], ['Power Bank 10000mAh','Electronics',950,1250,12], ['Power Bank 20000mAh','Electronics',1450,1800,9],
    ['Wireless Mouse','Electronics',550,750,15], ['Wireless Keyboard','Electronics',950,1200,10], ['Gaming Mouse','Electronics',850,1100,12],
    ['Laptop Stand','Electronics',750,950,14], ['Phone Stand','Electronics',250,350,22], ['Ring Light Mini','Electronics',550,750,15],
    ['Desk Lamp','Home & Living',590,750,9], ['LED Desk Lamp','Home & Living',750,950,12], ['Night Lamp','Home & Living',450,600,15],
    ['Study Lamp','Home & Living',650,850,14], ['Table Clock','Home & Living',450,600,16], ['Wall Clock','Home & Living',750,950,12],
    ['Digital Alarm Clock','Home & Living',650,850,13], ['Storage Box Small','Home & Living',250,350,25], ['Storage Box Large','Home & Living',450,600,20],
    ['Laundry Basket','Home & Living',550,750,14], ['Water Bottle 750ml','Home & Living',350,500,22], ['Thermal Bottle','Home & Living',850,1100,13],
    ['Coffee Mug','Home & Living',250,350,25], ['Ceramic Mug Set','Home & Living',550,750,15], ['Glass Tumbler','Home & Living',280,400,22],
    ['Lunch Box','Home & Living',450,600,18], ['Kitchen Organizer','Home & Living',650,850,13], ['Spice Rack','Home & Living',750,950,11],
    ['Cutlery Set','Home & Living',850,1100,10], ['Nonstick Pan','Home & Living',950,1250,9], ['Frying Pan','Home & Living',850,1100,10],
    ['Water Jug','Home & Living',550,750,14], ['Bedsheet Set','Home & Living',950,1250,10], ['Pillow Cover Set','Home & Living',450,600,18],
    ['Cushion Cover','Home & Living',250,350,24], ['Prayer Mat','Home & Living',550,750,16], ['Door Mat','Home & Living',450,600,15],
    ['Bathroom Mat','Home & Living',520,700,14], ['Hand Towel','Home & Living',250,350,25], ['Bath Towel','Home & Living',550,750,18],
    ['Microfiber Cloth Set','Home & Living',320,450,20], ['Car Cleaning Cloth','Automotive',350,500,18], ['Car Phone Holder','Automotive',550,750,14],
    ['Car Air Freshener','Automotive',250,350,22], ['Car Charging Adapter','Automotive',650,850,12], ['Bike Phone Holder','Automotive',450,600,16],
    ['Bike LED Light','Automotive',550,750,14], ['Tire Pressure Gauge','Automotive',650,850,10], ['Car Cleaning Brush','Automotive',300,450,20],
    ['Dashboard Mat','Automotive',350,500,18], ['Seat Belt Cover','Automotive',250,350,20], ['Kids T-Shirt','Kids',350,500,20],
    ['Kids Polo Shirt','Kids',420,550,18], ['Kids Jeans','Kids',550,750,16], ['Kids Hoodie','Kids',650,850,14],
    ['Kids Sneakers','Kids',750,950,12], ['Kids Sandals','Kids',450,600,16], ['School Lunch Bag','Kids',450,600,15],
    ['Kids Water Bottle','Kids',350,500,18], ['Coloring Book','Kids',180,250,25], ['Building Blocks Set','Kids',650,850,12],
    ['Puzzle Game','Kids',450,600,14], ['Drawing Set','Kids',350,500,18], ['Baby Blanket','Kids',750,950,10],
    ['Baby Feeding Bowl','Kids',280,400,20], ['Baby Bib Set','Kids',250,350,22], ['Notebook A5','Stationery',120,180,30],
    ['Notebook A4','Stationery',180,250,28], ['Premium Diary','Stationery',350,500,20], ['Ball Pen Set','Stationery',120,180,35],
    ['Gel Pen Set','Stationery',150,220,30], ['Marker Set','Stationery',250,350,24], ['Highlighter Set','Stationery',220,320,22],
    ['Pencil Set','Stationery',100,150,35], ['Geometry Box','Stationery',250,350,20], ['Desk Organizer','Stationery',350,500,18],
    ['Sticky Notes Set','Stationery',150,220,25], ['File Folder','Stationery',120,180,28], ['Document Bag','Stationery',250,350,22],
    ['Calculator','Stationery',350,500,15], ['Sketch Pen Set','Stationery',280,400,20], ['Phone Case','Mobile Accessories',250,400,25],
    ['Premium Phone Case','Mobile Accessories',450,650,20], ['Screen Protector','Mobile Accessories',180,300,30], ['Camera Lens Protector','Mobile Accessories',220,350,25],
    ['Phone Ring Holder','Mobile Accessories',150,250,28], ['Phone Grip','Mobile Accessories',180,280,25], ['Car Charger','Mobile Accessories',450,650,18],
    ['Wireless Charging Pad','Mobile Accessories',850,1100,12], ['Mobile Tripod','Mobile Accessories',650,850,14], ['Selfie Stick','Mobile Accessories',450,600,16],
    ['Earphone Case','Mobile Accessories',220,350,24], ['Cable Organizer','Mobile Accessories',150,250,30], ['USB Hub','Mobile Accessories',650,850,14],
    ['OTG Adapter','Mobile Accessories',180,280,25], ['Memory Card Reader','Mobile Accessories',350,500,18], ['Bluetooth Receiver','Mobile Accessories',450,600,16],
    ['LED Strip Light','Electronics',550,750,14], ['Mini Projector','Electronics',4500,5500,6], ['Webcam HD','Electronics',1450,1800,8],
    ['USB Microphone','Electronics',1250,1600,9], ['Gaming Headset','Electronics',1450,1850,8], ['Headphone Stand','Electronics',550,750,12],
    ['HDMI Cable','Electronics',350,500,20], ['USB Flash Drive 64GB','Electronics',650,850,14], ['USB Flash Drive 128GB','Electronics',950,1200,10],
    ['Extension Board','Electronics',650,850,15], ['Smart Plug','Electronics',850,1100,10], ['Mini Fan','Electronics',650,850,14], ['Rechargeable Fan','Electronics',1850,2300,8]
  ];

  const needed = Math.min(150 - existing, catalog.length);
  for (const [name, category, price, comparePrice, stock] of catalog.slice(0, needed)) {
    await db.query(
      'INSERT INTO products(name,category,description,price,compare_price,stock,image_url) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [name, category, `ShopNexa demo catalog product: ${name}. Replace with supplier-verified details and a real product image before selling.`, price, comparePrice, stock, '']
    );
  }
  return existing + needed;
}

publicRouter.get('/products', async (req,res,next) => {
  try {
    await ensureProductCatalog();
    const q = cleanText(req.query.q,100).toLowerCase();
    const cat = cleanText(req.query.category,80);
    const page = Math.max(1, Number.parseInt(req.query.page,10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit,10) || 24));
    const offset = (page-1)*limit;
    const values=[]; const where=['active=TRUE'];
    if(q){values.push(`%${q}%`);where.push(`LOWER(name||' '||category||' '||description) LIKE $${values.length}`)}
    if(cat && cat!=='All'){values.push(cat);where.push(`category=$${values.length}`)}
    const clause=where.join(' AND ');
    const count=await db.query(`SELECT COUNT(*)::int AS total FROM products WHERE ${clause}`,values);
    values.push(limit,offset);
    const result=await db.query(`SELECT id,name,category,description,price,compare_price,stock,image_url,created_at FROM products WHERE ${clause} ORDER BY id DESC LIMIT $${values.length-1} OFFSET $${values.length}`,values);
    const total=count.rows[0].total;
    res.json({products:result.rows,pagination:{page,limit,total,totalPages:Math.ceil(total/limit),hasNext:offset+result.rows.length<total}});
  } catch(e) { next(e); }
});

publicRouter.get('/products/:id', async (req,res,next) => {
  try {
    const id=Number(req.params.id);
    if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Invalid product id'});
    const r=await db.query('SELECT id,name,category,description,price,compare_price,stock,image_url FROM products WHERE id=$1 AND active=TRUE',[id]);
    if(!r.rowCount)return res.status(404).json({error:'Product not found'});
    res.json({product:r.rows[0]});
  } catch(e){next(e);}
});

publicRouter.get('/products/:id/reviews', async (req,res,next) => {
  try {
    const id=Number(req.params.id);
    if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Invalid product id'});
    const summary=await db.query(`SELECT COUNT(*)::int AS count,COALESCE(ROUND(AVG(rating),1),0)::numeric AS average FROM product_reviews WHERE product_id=$1`,[id]);
    const rows=await db.query(`SELECT id,reviewer_name,rating,comment,created_at FROM product_reviews WHERE product_id=$1 ORDER BY created_at DESC LIMIT 30`,[id]);
    res.json({summary:{count:summary.rows[0].count,average:Number(summary.rows[0].average)},reviews:rows.rows});
  } catch(e){next(e);}
});

publicRouter.post('/products/:id/reviews', async (req,res,next) => {
  try {
    const productId=Number(req.params.id);
    const name=cleanText(req.body.reviewerName,80);
    const code=cleanText(req.body.orderCode,40).toUpperCase();
    const rating=Number(req.body.rating);
    const comment=cleanText(req.body.comment,500);
    if(!Number.isSafeInteger(productId)||productId<=0)return res.status(400).json({error:'Invalid product id'});
    if(name.length<2||name.length>80)return res.status(400).json({error:'Enter your name'});
    if(!/^[A-Z0-9-]{4,40}$/.test(code))return res.status(400).json({error:'Enter a valid order code'});
    if(!Number.isInteger(rating)||rating<1||rating>5)return res.status(400).json({error:'Rating must be between 1 and 5'});
    if(comment.length>500)return res.status(400).json({error:'Review is too long'});
    const verified=await db.query(`SELECT o.id FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.order_code=$1 AND oi.product_id=$2 AND o.order_status='delivered' LIMIT 1`,[code,productId]);
    if(!verified.rowCount)return res.status(403).json({error:'Only customers with a delivered order can review this product'});
    const orderId=verified.rows[0].id;
    const inserted=await db.query(`INSERT INTO product_reviews(product_id,order_id,reviewer_name,rating,comment) VALUES($1,$2,$3,$4,$5) ON CONFLICT(order_id,product_id) DO NOTHING RETURNING id,reviewer_name,rating,comment,created_at`,[productId,orderId,name,rating,comment]);
    if(!inserted.rowCount)return res.status(409).json({error:'You have already reviewed this product for that order'});
    res.status(201).json({review:inserted.rows[0],message:'Thanks! Your verified review has been published.'});
  } catch(e){next(e);}
});

publicRouter.post('/orders', async (req,res,next) => {
  const name=cleanText(req.body.name,80), phone=cleanText(req.body.phone,20), address=cleanText(req.body.address,300), note=cleanText(req.body.note,300);
  if(name.length<2 || !bdPhone(phone) || address.length<5) return res.status(400).json({error:'Enter a name, valid Bangladesh mobile number (01XXXXXXXXX), and full address'});
  if(!Array.isArray(req.body.items)||!req.body.items.length||req.body.items.length>30) return res.status(400).json({error:'Cart is empty or too large'});
  const rawItems=req.body.items.map(x=>({id:Number(x.id),qty:Number(x.quantity)}));
  if(rawItems.some(x=>!Number.isInteger(x.id)||!Number.isInteger(x.qty)||x.qty<1||x.qty>20)) return res.status(400).json({error:'Invalid product or quantity'});
  const itemMap=new Map();
  for(const item of rawItems)itemMap.set(item.id,(itemMap.get(item.id)||0)+item.qty);
  const items=[...itemMap.entries()].map(([id,qty])=>({id,qty}));
  if(items.some(x=>x.qty>20))return res.status(400).json({error:'Maximum quantity per product is 20'});
  const method=['cod','sslcommerz'].includes(req.body.paymentMethod)?req.body.paymentMethod:'cod';
  const client=await db.connect();
  try {
    await client.query('BEGIN');
    const orderItems=[]; let subtotal=0;
    for (const item of items) {
      const pr=await client.query('SELECT * FROM products WHERE id=$1 AND active=TRUE FOR UPDATE',[item.id]);
      const p=pr.rows[0];
      if(!p) throw Object.assign(new Error('A product is unavailable'),{status:400});
      if(p.stock<item.qty) throw Object.assign(new Error(`Not enough stock for ${p.name}`),{status:409});
      subtotal += p.price*item.qty;
      orderItems.push({p,qty:item.qty,line:p.price*item.qty});
    }
    const code=orderCode(), deliveryFee=0, total=subtotal+deliveryFee;
    const inserted=await client.query(`INSERT INTO orders(order_code,customer_name,phone,address,note,subtotal,delivery_fee,total,payment_method,payment_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,[code,name,phone,address,note,subtotal,deliveryFee,total,method,method==='cod'?'unpaid':'pending']);
    const orderId=inserted.rows[0].id;
    for (const it of orderItems) {
      await client.query('INSERT INTO order_items(order_id,product_id,product_name,unit_price,quantity,line_total) VALUES($1,$2,$3,$4,$5,$6)',[orderId,it.p.id,it.p.name,it.p.price,it.qty,it.line]);
      await client.query('UPDATE products SET stock=stock-$1,updated_at=NOW() WHERE id=$2',[it.qty,it.p.id]);
      await client.query('INSERT INTO stock_movements(product_id,order_id,quantity_change,reason) VALUES($1,$2,$3,$4)',[it.p.id,orderId,-it.qty,'order placed']);
    }
    await client.query('COMMIT');
    res.status(201).json({orderCode:code,total,paymentMethod:method,message:'Order saved. Stock has been reserved. Save your order code to track it.'});
  } catch(e) {
    await client.query('ROLLBACK').catch(()=>{});
    res.status(e.status||500).json({error:e.status?e.message:'Could not create order'});
  } finally { client.release(); }
});

publicRouter.get('/orders/:code/tracking', async (req,res,next) => {
  try {
    const code=cleanText(req.params.code,40).toUpperCase();
    const r=await db.query('SELECT order_code,order_status,payment_status,courier,tracking_code,courier_status,created_at,updated_at FROM orders WHERE order_code=$1',[code]);
    const o=r.rows[0];
    if(!o)return res.status(404).json({error:'Order not found'});
    res.json({order:{orderCode:o.order_code,orderStatus:o.order_status,paymentStatus:o.payment_status,courier:o.courier,trackingCode:o.tracking_code,courierStatus:o.courier_status,createdAt:o.created_at,updatedAt:o.updated_at}});
  } catch(e){next(e);}
});
