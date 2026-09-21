import { businessCatalog } from '../adapters/index.js';
import { ApiError } from '../errors/apiError.js';
import { analyticsRepository } from '../repositories/analyticsRepository.js';
import type { AnalyticsRepository } from '../repositories/analyticsRepository.js';
import { productService } from './productService.js';
import type { AdminAnalytics, AnalyticsDatabaseData, ClusterSummary, ClusteredProduct } from '../types/analytics.js';
import type { NormalizedProduct, ProductAggregation } from '../types/product.js';

type ProductLoader = () => Promise<ProductAggregation>;
const round = (value:number) => Math.round(value * 100) / 100;

export function runKMeans(input: NormalizedProduct[], requestedK = 3) {
  const products = input.filter(p => Number.isFinite(Number(p.price)) && Number.isFinite(Number(p.stock))).map(p => ({...p,price:Number(p.price),stock:Number(p.stock)}));
  if (!products.length) return { products:[] as ClusteredProduct[], clusters:[] as ClusterSummary[] };
  const meanPrice=products.reduce((s,p)=>s+p.price,0)/products.length, meanStock=products.reduce((s,p)=>s+p.stock,0)/products.length;
  const sdPrice=Math.sqrt(products.reduce((s,p)=>s+(p.price-meanPrice)**2,0)/products.length)||1;
  const sdStock=Math.sqrt(products.reduce((s,p)=>s+(p.stock-meanStock)**2,0)/products.length)||1;
  const points=products.map((p,index)=>({index,x:(p.price-meanPrice)/sdPrice,y:(p.stock-meanStock)/sdStock}));
  const k=Math.min(Math.max(1,requestedK),points.length);
  const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y||a.index-b.index);
  let centroids=Array.from({length:k},(_,i)=>{const p=sorted[Math.round(i*(sorted.length-1)/Math.max(1,k-1))];return{x:p.x,y:p.y};});
  let assignments=new Array(points.length).fill(-1);
  for(let iteration=0;iteration<100;iteration++){
    const next=points.map(p=>centroids.reduce((best,c,i)=>{const d=(p.x-c.x)**2+(p.y-c.y)**2;return d<best.d?{i,d}:best;},{i:0,d:Infinity}).i);
    if(next.every((v,i)=>v===assignments[i])) break;
    assignments=next;
    centroids=centroids.map((old,i)=>{const members=points.filter((_,j)=>assignments[j]===i);return members.length?{x:members.reduce((s,p)=>s+p.x,0)/members.length,y:members.reduce((s,p)=>s+p.y,0)/members.length}:old;});
  }
  const clustered=products.map((p,i)=>({id:p.id,name:p.name,business:p.catalog_business ?? p.business,price:p.price,stock:p.stock,cluster:assignments[i]+1}));
  const clusters=centroids.map((c,i)=>{const members=clustered.filter(p=>p.cluster===i+1);const cp=c.x*sdPrice+meanPrice,cs=c.y*sdStock+meanStock;return{cluster:i+1,label:clusterLabel(cp,cs,meanPrice,meanStock),product_count:members.length,average_price:round(members.reduce((s,p)=>s+p.price,0)/Math.max(1,members.length)),average_stock:round(members.reduce((s,p)=>s+p.stock,0)/Math.max(1,members.length)),centroid_price:round(cp),centroid_stock:round(cs)};});
  return {products:clustered,clusters};
}

function clusterLabel(price:number,stock:number,meanPrice:number,meanStock:number){
  const highPrice=price>meanPrice*1.1, lowPrice=price<meanPrice*.9, highStock=stock>meanStock*1.1, lowStock=stock<meanStock*.9;
  if(highPrice&&lowStock)return'High Value / Lower Stock'; if(highPrice&&highStock)return'High Value / Higher Stock';
  if(lowPrice&&highStock)return'Lower Value / Higher Stock'; if(lowPrice&&lowStock)return'Lower Value / Lower Stock'; return'Balanced Inventory';
}

export function buildAnalytics(database:AnalyticsDatabaseData, aggregation:ProductAggregation):AdminAnalytics{
  const seen=new Set<string>(); const products=aggregation.products.filter(p=>{const key=`${p.business}:${p.id}`;if(seen.has(key))return false;seen.add(key);return true;});
  const inventory=['In Stock','Low Stock','Out of Stock'].map(status=>({status,count:products.filter(p=>p.status===status).length}));
  const effective=(p:NormalizedProduct)=>p.catalog_business??(p.business==='vault'?null:p.business);
  const productsByBusiness=businessCatalog.map(b=>({business:b.id,name:b.name,count:products.filter(p=>effective(p)===b.id).length,available:aggregation.businesses.find(a=>a.business===b.id)?.status!=='unavailable'}));
  const kmeans=runKMeans(products);
  const highest=[...database.revenue_by_business].sort((a,b)=>b.revenue-a.revenue)[0]; const top=database.top_products[0];
  const low=inventory[1].count,out=inventory[2].count,awaiting=database.order_statuses.filter(s=>['pending','confirmed'].includes(s.status)).reduce((s,v)=>s+v.count,0);
  const insights=[`${low} products are currently low in stock.`,`${out} products are currently out of stock.`];
  if(highest&&highest.revenue>0)insights.push(`${businessCatalog.find(b=>b.id===highest.business)?.name??highest.business} has the highest recorded revenue.`);
  if(top)insights.push(`${top.name} is the highest-selling product by quantity.`); if(awaiting)insights.push(`${awaiting} orders are still awaiting processing.`);
  const constrained=kmeans.clusters.find(c=>c.label==='High Value / Lower Stock'); if(constrained)insights.push(`Cluster ${constrained.cluster} contains high-value products with relatively low inventory.`);
  return {kpis:{total_revenue:database.total_revenue,total_orders:database.total_orders,total_customers:database.total_customers,average_order_value:database.valid_orders?round(database.total_revenue/database.valid_orders):0,total_products:products.length,in_stock:inventory[0].count,low_stock:low,out_of_stock:out},revenue_trend:database.revenue_trend,revenue_by_business:database.revenue_by_business,inventory,products_by_business:productsByBusiness,order_statuses:database.order_statuses,top_products:database.top_products,kmeans,insights,business_availability:aggregation.businesses,recent_orders:database.recent_orders,warnings:aggregation.businesses.filter(b=>b.status==='unavailable').map(b=>`${b.business_name} product API is unavailable.`)};
}

export function createAnalyticsService(repository:AnalyticsRepository=analyticsRepository,loadProducts:ProductLoader=()=>productService.getProductAggregation()){
  return {async getAnalytics(){const [db,products]=await Promise.allSettled([repository.load(),loadProducts()]);if(db.status==='rejected')throw new ApiError(503,'ANALYTICS_DATABASE_UNAVAILABLE','Analytics data is temporarily unavailable.');const aggregation=products.status==='fulfilled'?products.value:{products:[],businesses:businessCatalog.map(b=>({business:b.id,business_name:b.name,status:'unavailable' as const,product_count:0}))};const result=buildAnalytics(db.value,aggregation);if(products.status==='rejected')result.warnings.push('Current product inventory is temporarily unavailable.');return result;}};
}
export const analyticsService=createAnalyticsService();
