import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireAdmin, ADMIN_COOKIE, hashSessionToken } from '../auth.js';
import { cleanText } from '../utils.js';
export const adminRouter=Router();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const cookieOptions = {httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/'};
const ORDER_TRANSITIONS={pending:new Set(['confirmed','cancelled']),confirmed:new Set(['processing','cancelled']),processing:new Set(['shipped','cancelled']),shipped:new Set(['delivered']),delivered:new Set(),cancelled:new Set()};
const PAYMENT_TRANSITIONS={unpaid:new Set(['pending','paid']),pending:new Set(['paid','failed']),failed:new Set(['pending','paid']),paid:new Set(['refunded']),refunded:new Set()};

adminRouter.post('/login', async (req, res, next) => {
  try {
    const email=cleanText(req.body.email,150).toLowerCase(),password=String(req.body.password||'');
    if(!email||!password)return res.status(400).json({error:'Email and password are required'});
    const result=await db.query('SELECT * FROM admins WHERE email=$1',[email]),admin=result.rows[0];
    if(!admin||!(await bcrypt.compare(password,admin.password_hash)))return res.status(401).json({error:'Email or password is incorrect'});
    const token=crypto.randomBytes(32).toString('base64url'),tokenHash=hashSessionToken(token);
    await db.query(`INSERT INTO admin_sessions(admin_id, token_hash, expires_at) VALUES($1,$2,NOW()+INTERVAL '8 hours')`,[admin.id,tokenHash]);
    res.cookie(ADMIN_COOKIE,token,{...cookieOptions,maxAge:SESSION_TTL_MS});
    return res.json({ok:true,email:admin.email});
  } catch(error){return next(error)}
});

adminRouter.post('/logout',requireAdmin,async(req,res,next)=>{
  try{await db.query('UPDATE admin_sessions SET revoked_at=NOW() WHERE id=$1 AND revoked_at IS NULL',[req.admin.sessionId]);res.clearCookie(ADMIN_COOKIE,cookieOptions);return res.json({ok:true})}catch(error){return next(error)}
});
adminRouter.use(requireAdmin);

adminRouter.get('/dashboard',async(_req,res,next)=>{
  try{const [products,orders,paid,pending,lowStock]=await Promise.all([db.query('SELECT COUNT(*)::int n FROM products'),db.query('SELECT COUNT(*)::int n FROM orders'),db.query("SELECT COALESCE(SUM(total),0)::int n FROM orders WHERE payment_status='paid'"),db.query("SELECT COUNT(*)::int n FROM orders WHERE order_status IN ('pending','confirmed','processing')"),db.query('SELECT COUNT(*)::int n FROM products WHERE stock<=5 AND active=TRUE')]);res.json({products:products.rows[0].n,orders:orders.rows[0].n,paidRevenue:paid.rows[0].n,pendingOrders:pending.rows[0].n,lowStock:lowStock.rows[0].n})}catch(e){next(e)}
});

adminRouter.get('/products',async(_req,res,next)=>{try{res.json({products:(await db.query('SELECT * FROM products ORDER BY id DESC')).rows})}catch(e){next(e)}});
adminRouter.post('/products',async(req,res,next)=>{
  try{const name=cleanText(req.body.name,150),category=cleanText(req.body.category,80)||'General',description=cleanText(req.body.description,2000),price=Number(req.body.price),compare=req.body.comparePrice===''||req.body.comparePrice==null?null:Number(req.body.comparePrice),stock=Number(req.body.stock),image=cleanText(req.body.imageUrl,1000);if(!name||!Number.isInteger(price)||price<0||!Number.isInteger(stock)||stock<0||!(compare===null||(Number.isInteger(compare)&&compare>=0)))return res.status(400).json({error:'Name, non-negative integer price/stock, and valid compare price required'});const r=await db.query('INSERT INTO products(name,category,description,price,compare_price,stock,image_url) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[name,category,description,price,compare,stock,image]);res.status(201).json({product:r.rows[0]})}catch(e){next(e)}
});
adminRouter.patch('/products/:id',async(req,res,next)=>{
  try{const id=Number(req.params.id),found=await db.query('SELECT * FROM products WHERE id=$1',[id]),p=found.rows[0];if(!p)return res.status(404).json({error:'Product not found'});const name=cleanText(req.body.name??p.name,150),category=cleanText(req.body.category??p.category,80),description=cleanText(req.body.description??p.description,2000),price=Number(req.body.price??p.price),stock=Number(req.body.stock??p.stock),image=cleanText(req.body.imageUrl??p.image_url,1000),active=req.body.active===undefined?p.active:Boolean(req.body.active);if(!name||!Number.isInteger(price)||price<0||!Number.isInteger(stock)||stock<0)return res.status(400).json({error:'Invalid product data'});const r=await db.query('UPDATE products SET name=$1,category=$2,description=$3,price=$4,stock=$5,image_url=$6,active=$7,updated_at=NOW() WHERE id=$8 RETURNING *',[name,category,description,price,stock,image,active,id]);if(stock!==p.stock)await db.query('INSERT INTO stock_movements(product_id,quantity_change,reason) VALUES($1,$2,$3)',[id,stock-p.stock,'admin stock adjustment']);res.json({product:r.rows[0]})}catch(e){next(e)}
});

adminRouter.get('/orders',async(req,res,next)=>{
  try{
    const status=cleanText(req.query.status,40),result=status?await db.query('SELECT * FROM orders WHERE order_status=$1 ORDER BY id DESC LIMIT 300',[status]):await db.query('SELECT * FROM orders ORDER BY id DESC LIMIT 300');
    const ids=result.rows.map(o=>o.id);let itemRows=[];
    if(ids.length)itemRows=(await db.query('SELECT order_id,product_name,unit_price,quantity,line_total FROM order_items WHERE order_id=ANY($1::bigint[]) ORDER BY id',[ids])).rows;
    const byOrder=new Map();for(const item of itemRows){if(!byOrder.has(item.order_id))byOrder.set(item.order_id,[]);byOrder.get(item.order_id).push({product_name:item.product_name,unit_price:item.unit_price,quantity:item.quantity,line_total:item.line_total})}
    res.json({orders:result.rows.map(o=>({...o,items:byOrder.get(o.id)||[]}))});
  }catch(e){next(e)}
});

adminRouter.patch('/orders/:id/status',async(req,res,next)=>{
  const client=await db.connect();
  try{
    const id=Number(req.params.id),status=cleanText(req.body.status,30);
    if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Invalid order id'});
    if(!Object.prototype.hasOwnProperty.call(ORDER_TRANSITIONS,status))return res.status(400).json({error:'Invalid order status'});
    await client.query('BEGIN');
    const found=await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id]),o=found.rows[0];
    if(!o){await client.query('ROLLBACK');return res.status(404).json({error:'Order not found'})}
    if(status===o.order_status){await client.query('COMMIT');return res.json({ok:true,unchanged:true})}
    if(!ORDER_TRANSITIONS[o.order_status].has(status)){await client.query('ROLLBACK');return res.status(409).json({error:`Invalid order transition: ${o.order_status} -> ${status}`})}
    if(status==='cancelled'){
      const its=await client.query('SELECT product_id,quantity FROM order_items WHERE order_id=$1',[id]);
      for(const it of its.rows){await client.query('UPDATE products SET stock=stock+$1,updated_at=NOW() WHERE id=$2',[it.quantity,it.product_id]);await client.query('INSERT INTO stock_movements(product_id,order_id,quantity_change,reason) VALUES($1,$2,$3,$4)',[it.product_id,id,it.quantity,'cancelled order stock returned'])}
    }
    await client.query('UPDATE orders SET order_status=$1,updated_at=NOW() WHERE id=$2',[status,id]);
    await client.query('COMMIT');res.json({ok:true,status});
  }catch(e){await client.query('ROLLBACK').catch(()=>{});next(e)}finally{client.release()}
});

adminRouter.patch('/orders/:id/payment',async(req,res,next)=>{
  const client=await db.connect();
  try{
    const id=Number(req.params.id),status=cleanText(req.body.status,20);
    if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Invalid order id'});
    if(!Object.prototype.hasOwnProperty.call(PAYMENT_TRANSITIONS,status))return res.status(400).json({error:'Invalid payment status'});
    await client.query('BEGIN');
    const found=await client.query('SELECT payment_status FROM orders WHERE id=$1 FOR UPDATE',[id]),o=found.rows[0];
    if(!o){await client.query('ROLLBACK');return res.status(404).json({error:'Order not found'})}
    if(status===o.payment_status){await client.query('COMMIT');return res.json({ok:true,unchanged:true})}
    if(!PAYMENT_TRANSITIONS[o.payment_status].has(status)){await client.query('ROLLBACK');return res.status(409).json({error:`Invalid payment transition: ${o.payment_status} -> ${status}`})}
    await client.query('UPDATE orders SET payment_status=$1,updated_at=NOW() WHERE id=$2',[status,id]);
    await client.query('COMMIT');res.json({ok:true,status});
  }catch(e){await client.query('ROLLBACK').catch(()=>{});next(e)}finally{client.release()}
});

adminRouter.get('/stock-movements',async(_req,res,next)=>{try{const r=await db.query('SELECT sm.*,p.name product_name FROM stock_movements sm JOIN products p ON p.id=sm.product_id ORDER BY sm.id DESC LIMIT 500');res.json({movements:r.rows})}catch(e){next(e)}});
