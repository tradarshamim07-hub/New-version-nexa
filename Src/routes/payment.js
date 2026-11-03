import { Router } from 'express';
import { db } from '../db.js';
import { cleanText } from '../utils.js';
export const paymentRouter=Router();
const base=()=>process.env.SSLCOMMERZ_LIVE==='true'?'https://securepay.sslcommerz.com':'https://sandbox.sslcommerz.com';
const FETCH_TIMEOUT_MS=10000;

paymentRouter.post('/sslcommerz/init',async(req,res,next)=>{
  try {
    const code=cleanText(req.body.orderCode,40).toUpperCase(),r=await db.query('SELECT * FROM orders WHERE order_code=$1',[code]),o=r.rows[0];
    if(!o)return res.status(404).json({error:'Order not found'});
    if(o.payment_method!=='sslcommerz')return res.status(400).json({error:'Order was not created for online payment'});
    if(o.payment_status==='paid')return res.status(409).json({error:'Order already paid'});
    if(!process.env.SSLCOMMERZ_STORE_ID||!process.env.SSLCOMMERZ_STORE_PASSWORD)return res.status(503).json({error:'Online payment is not configured. Add merchant credentials in server environment.'});
    const root=(process.env.BASE_URL||'http://localhost:3000').replace(/\/$/,'');
    const payload=new URLSearchParams({store_id:process.env.SSLCOMMERZ_STORE_ID,store_passwd:process.env.SSLCOMMERZ_STORE_PASSWORD,total_amount:Number(o.total).toFixed(2),currency:'BDT',tran_id:o.order_code,success_url:root+'/api/payment/sslcommerz/success',fail_url:root+'/api/payment/sslcommerz/fail',cancel_url:root+'/api/payment/sslcommerz/cancel',ipn_url:root+'/api/payment/sslcommerz/ipn',shipping_method:'NO',product_name:'ShopNexa order '+o.order_code,product_category:'ecommerce',product_profile:'general',cus_name:o.customer_name,cus_email:'customer@example.com',cus_add1:o.address,cus_city:'Bangladesh',cus_postcode:'0000',cus_country:'Bangladesh',cus_phone:o.phone});
    const response=await fetch(base()+'/gwprocess/v4/api.php',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:payload,signal:AbortSignal.timeout(FETCH_TIMEOUT_MS)});
    const data=await response.json().catch(()=>({}));
    if(data.status!=='SUCCESS'||!data.GatewayPageURL)return res.status(502).json({error:'Payment gateway did not initialize',detail:data.failedreason||data.status});
    res.json({paymentUrl:data.GatewayPageURL});
  } catch(e){next(e)}
});

async function verifyAndUpdate(body){
  const tran=cleanText(body.tran_id,60),val=cleanText(body.val_id,100),status=cleanText(body.status,30).toUpperCase();
  if(!tran||!val||status!=='VALID'||!process.env.SSLCOMMERZ_STORE_ID||!process.env.SSLCOMMERZ_STORE_PASSWORD)return false;
  const client=await db.connect();
  try {
    await client.query('BEGIN');
    const result=await client.query('SELECT * FROM orders WHERE order_code=$1 FOR UPDATE',[tran]),o=result.rows[0];
    if(!o){await client.query('ROLLBACK');return false;}
    if(o.payment_status==='paid'){
      await client.query('COMMIT');
      return Boolean(o.gateway_transaction_id&&o.gateway_transaction_id===cleanText(body.bank_tran_id||body.val_id,100));
    }
    const verify=new URLSearchParams({val_id:val,store_id:process.env.SSLCOMMERZ_STORE_ID,store_passwd:process.env.SSLCOMMERZ_STORE_PASSWORD,format:'json'});
    const response=await fetch(base()+'/validator/api/validationserverAPI.php?'+verify.toString(),{signal:AbortSignal.timeout(FETCH_TIMEOUT_MS)}),d=await response.json().catch(()=>({}));
    const valid=['VALID','VALIDATED'].includes(String(d.status||'').toUpperCase())&&String(d.tran_id)===o.order_code&&Number(d.amount)===Number(Number(o.total).toFixed(2))&&String(d.currency)==='BDT';
    if(!valid){await client.query('ROLLBACK');return false;}
    const gatewayId=cleanText(d.bank_tran_id||val,100);
    await client.query("UPDATE orders SET payment_status='paid',gateway_transaction_id=$1,updated_at=NOW() WHERE id=$2 AND payment_status<>'paid'",[gatewayId,o.id]);
    await client.query('INSERT INTO payment_events(order_id,provider,event_type,payload) SELECT $1,$2,$3,$4 WHERE NOT EXISTS (SELECT 1 FROM payment_events WHERE order_id=$1 AND provider=$2 AND event_type=$3)',[o.id,'sslcommerz','verified',JSON.stringify({status:d.status,tran_id:d.tran_id,bank_tran_id:gatewayId})]);
    await client.query('COMMIT');
    return true;
  } catch(e){await client.query('ROLLBACK').catch(()=>{});throw e} finally {client.release()}
}

paymentRouter.post('/sslcommerz/ipn',async(req,res)=>{try{const ok=await verifyAndUpdate(req.body);res.status(ok?200:400).send(ok?'OK':'INVALID')}catch{res.status(500).send('ERROR')}});
for(const kind of ['success','fail','cancel']){
  paymentRouter.all('/sslcommerz/'+kind,async(req,res)=>{
    let ok=false;try{if(kind==='success')ok=await verifyAndUpdate({...req.query,...req.body})}catch{}
    const dest=(process.env.FRONTEND_ORIGIN||'http://localhost:3000').split(',')[0].trim();
    res.redirect(dest+'/?payment='+(ok?'success':kind==='success'?'pending':kind));
  });
}
