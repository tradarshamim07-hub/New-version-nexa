import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { db, initDb } from './src/db.js';
import { initReviews } from './src/reviews.js';
import { ensureProductCatalog, publicRouter } from './src/routes/public.js';
import { adminRouter } from './src/routes/admin.js';
import { paymentRouter } from './src/routes/payment.js';
import { courierRouter } from './src/routes/courier.js';

const app=express();
const __dirname=path.dirname(fileURLToPath(import.meta.url));
app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:false}));
app.use(cors({origin:(process.env.FRONTEND_ORIGIN||'http://localhost:3000').split(',').map(s=>s.trim()),credentials:true}));
app.use(express.json({limit:'100kb'}));
app.use(express.urlencoded({extended:false,limit:'100kb'}));
app.use(cookieParser());
app.use(morgan('tiny'));
app.use('/api/',rateLimit({windowMs:15*60*1000,limit:250,standardHeaders:true,legacyHeaders:false}));
const adminLoginLimiter=rateLimit({windowMs:15*60*1000,limit:5,standardHeaders:true,legacyHeaders:false,message:{error:'Too many login attempts. Try again in 15 minutes.'}});
app.use('/api/admin/login',adminLoginLimiter);

app.use(express.static(path.join(__dirname,'public')));
app.get('/api/health',(_req,res)=>res.json({ok:true,service:'ShopNexa PostgreSQL API',time:new Date().toISOString()}));
app.use('/api',publicRouter);
app.use('/api/admin',adminRouter);
app.use('/api/payment',paymentRouter);
app.use('/api/courier',courierRouter);
app.use((err,_req,res,_next)=>{console.error(err);res.status(err.status||500).json({error:err.status?err.message:'Server error. Check server logs.'})});

const port=Number(process.env.PORT||3000);
try{
  await initDb();
  await initReviews();
  const catalogCount=await ensureProductCatalog();
  console.log(`ShopNexa product catalog ready: ${catalogCount} products`);
  app.listen(port,()=>console.log(`ShopNexa PostgreSQL backend listening on port ${port}`));
}catch(e){
  console.error('Database initialization failed. Check DATABASE_URL and PostgreSQL network access.',e);
  process.exit(1);
}
process.on('SIGINT',async()=>{await db.end();process.exit(0)});
process.on('SIGTERM',async()=>{await db.end();process.exit(0)});
