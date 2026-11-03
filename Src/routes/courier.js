import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { cleanText } from '../utils.js';
export const courierRouter=Router();
const FETCH_TIMEOUT_MS=10000;

courierRouter.post('/steadfast/create',requireAdmin,async(req,res,next)=>{
  try {
    const id=Number(req.body.orderId);
    if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Invalid order id'});
    const found=await db.query('SELECT * FROM orders WHERE id=$1',[id]),o=found.rows[0];
    if(!o)return res.status(404).json({error:'Order not found'});
    if(o.tracking_code||o.courier)return res.status(409).json({error:'Order has already been submitted to a courier'});
    const isCod=o.payment_method==='cod';
    if(!isCod&&o.payment_status!=='paid')return res.status(409).json({error:'Online payment must be completed before courier submission'});
    if(!isCod&&o.payment_method!=='sslcommerz')return res.status(400).json({error:'Unsupported payment method'});
    if(!process.env.STEADFAST_API_KEY||!process.env.STEADFAST_SECRET_KEY)return res.status(503).json({error:'Courier API is not configured'});
    const payload={invoice:o.order_code,recipient_name:o.customer_name,recipient_phone:o.phone,recipient_address:o.address,cod_amount:isCod?o.total:0,note:o.note||'ShopNexa order'};
    const response=await fetch((process.env.STEADFAST_BASE_URL||'https://portal.steadfast.com.bd/api/v1').replace(/\/$/,'')+'/create_order',{method:'POST',headers:{'Content-Type':'application/json','Api-Key':process.env.STEADFAST_API_KEY,'Secret-Key':process.env.STEADFAST_SECRET_KEY},body:JSON.stringify(payload),signal:AbortSignal.timeout(FETCH_TIMEOUT_MS)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.status==='error')return res.status(502).json({error:'Courier rejected order',detail:data.message||data});
    const tracking=cleanText(data.consignment?.consignment_id||data.consignment_id||data.tracking_code,100);
    const status=cleanText(data.consignment?.status||data.status||'created',100);
    if(!tracking)return res.status(502).json({error:'Courier response did not include a tracking code'});
    await db.query("UPDATE orders SET courier='steadfast',tracking_code=$1,courier_status=$2,order_status='shipped',updated_at=NOW() WHERE id=$3 AND tracking_code IS NULL AND courier IS NULL",[tracking,status,id]);
    await db.query('INSERT INTO courier_events(order_id,provider,status,payload) VALUES($1,$2,$3,$4)',[id,'steadfast','created',JSON.stringify(data)]);
    res.json({ok:true,trackingCode:tracking,courierResponse:data});
  } catch(e){next(e)}
});

courierRouter.post('/steadfast/refresh/:orderId',requireAdmin,async(req,res,next)=>{
  try {
    const id=Number(req.params.orderId);
    if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Invalid order id'});
    const found=await db.query('SELECT * FROM orders WHERE id=$1',[id]),o=found.rows[0];
    if(!o||!o.tracking_code)return res.status(404).json({error:'Order or tracking code not found'});
    if(!process.env.STEADFAST_API_KEY||!process.env.STEADFAST_SECRET_KEY)return res.status(503).json({error:'Courier API is not configured'});
    const url=(process.env.STEADFAST_BASE_URL||'https://portal.steadfast.com.bd/api/v1').replace(/\/$/,'')+'/status_by_cid/'+encodeURIComponent(o.tracking_code);
    const response=await fetch(url,{headers:{'Api-Key':process.env.STEADFAST_API_KEY,'Secret-Key':process.env.STEADFAST_SECRET_KEY},signal:AbortSignal.timeout(FETCH_TIMEOUT_MS)}),data=await response.json().catch(()=>({}));
    if(!response.ok)return res.status(502).json({error:'Courier status request failed',detail:data});
    const status=cleanText(data.delivery_status||data.status||data.consignment?.status||'unknown',100);
    const mapped=status.toLowerCase().includes('deliver')?'delivered':status.toLowerCase().includes('cancel')?'cancelled':o.order_status;
    await db.query('UPDATE orders SET courier_status=$1,order_status=$2,updated_at=NOW() WHERE id=$3',[status,mapped,id]);
    await db.query('INSERT INTO courier_events(order_id,provider,status,payload) VALUES($1,$2,$3,$4)',[id,'steadfast',status,JSON.stringify(data)]);
    res.json({ok:true,status,data});
  } catch(e){next(e)}
});
