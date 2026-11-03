import crypto from 'node:crypto';

export function orderCode(){
  return 'SN'+Date.now().toString(36).slice(-7).toUpperCase()+crypto.randomBytes(8).toString('hex').toUpperCase();
}

export function bdPhone(value){return /^01[3-9]\d{8}$/.test(String(value||''))}
export function cleanText(v,max=300){return String(v??'').trim().slice(0,max)}
export function publicOrder(row){return {orderCode:row.order_code,orderStatus:row.order_status,paymentStatus:row.payment_status,courier:row.courier,trackingCode:row.tracking_code,courierStatus:row.courier_status,createdAt:row.created_at,total:row.total}}
