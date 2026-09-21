import { useMemo,useState } from 'react';
import { Bar,BarChart,CartesianGrid,Cell,Legend,Line,LineChart,Pie,PieChart,ResponsiveContainer,Scatter,ScatterChart,Tooltip,XAxis,YAxis } from 'recharts';
import type { AdminAnalytics as Analytics,AdminOrderSummary } from '../types/admin';

const money=new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0});
const compact=new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1});
const colors=['#294638','#8f6846','#c1a86d','#71806f','#b96f56','#4f6b78'];
const businessNames:Record<string,string>={door:'Door',plug:'Electrical Plug',brandname:'Brandname',clothing:'Clothing',powerbank:'Powerbank',projector:'Projector'};
const statusLabel=(value:string)=>value==='completed'?'Completed':value[0].toUpperCase()+value.slice(1);

export default function AdminAnalytics({data,onOpen}:{data:Analytics;onOpen:(orderNo:string)=>void}){
 const [period,setPeriod]=useState<'7'|'30'|'all'>('30');
 const trend=useMemo(()=>period==='all'?data.revenue_trend:data.revenue_trend.slice(-Number(period)),[data.revenue_trend,period]);
 const revenue=data.revenue_by_business.map(x=>({...x,name:businessNames[x.business]??x.business}));
 const statuses=data.order_statuses.map(x=>({...x,name:statusLabel(x.status)}));
 const chartProps={width:'100%',height:'100%'} as const;
 return <div className="admin-content analytics-dashboard">
  <section className="analytics-kpis" aria-label="Executive metrics">{[
   ['Total revenue',money.format(data.kpis.total_revenue)],['Total orders',data.kpis.total_orders],['Total customers',data.kpis.total_customers],['Average order value',money.format(data.kpis.average_order_value)],['Total products',data.kpis.total_products],['In stock',data.kpis.in_stock],['Low stock',data.kpis.low_stock],['Out of stock',data.kpis.out_of_stock]
  ].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
  {data.warnings.length>0&&<div className="analytics-warning" role="status"><strong>Partial inventory data</strong>{data.warnings.map(x=><span key={x}>{x}</span>)}</div>}
  <div className="analytics-grid">
   <Chart title="Revenue Trend" className="analytics-wide" action={<div className="period-tabs">{(['7','30','all'] as const).map(x=><button key={x} className={period===x?'is-active':''} onClick={()=>setPeriod(x)}>{x==='all'?'All':`${x} Days`}</button>)}</div>} empty={!trend.length}><ResponsiveContainer {...chartProps}><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tick={{fontSize:10}}/><YAxis tickFormatter={v=>compact.format(v)} tick={{fontSize:10}}/><Tooltip formatter={v=>money.format(Number(v))}/><Line type="monotone" dataKey="revenue" stroke="#294638" strokeWidth={2} dot={{r:3}}/></LineChart></ResponsiveContainer></Chart>
   <Chart title="Revenue by Business" empty={!revenue.length}><ResponsiveContainer {...chartProps}><BarChart data={revenue}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" tick={{fontSize:9}} interval={0}/><YAxis tickFormatter={v=>compact.format(v)} tick={{fontSize:10}}/><Tooltip formatter={v=>money.format(Number(v))}/><Bar dataKey="revenue" fill="#294638" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></Chart>
   <Chart title="Inventory / Stock Health" empty={!data.inventory.length}><ResponsiveContainer {...chartProps}><PieChart><Pie data={data.inventory} dataKey="count" nameKey="status" innerRadius="45%" outerRadius="72%" label>{data.inventory.map((_,i)=><Cell key={i} fill={colors[i]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></Chart>
   <Chart title="Products by Business" empty={!data.products_by_business.length}><ResponsiveContainer {...chartProps}><BarChart data={data.products_by_business} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number"/><YAxis type="category" dataKey="name" width={90} tick={{fontSize:10}}/><Tooltip/><Bar dataKey="count" fill="#8f6846" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer></Chart>
   <Chart title="Order Status Analytics" empty={!statuses.length}><ResponsiveContainer {...chartProps}><BarChart data={statuses}><XAxis dataKey="name" tick={{fontSize:9}} interval={0}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="count">{statuses.map((_,i)=><Cell key={i} fill={colors[i%colors.length]}/>)}</Bar></BarChart></ResponsiveContainer></Chart>
   <Chart title="K-Means Product Segmentation" className="analytics-wide analytics-kmeans" subtitle="K-Means groups products with similar price and inventory characteristics to support inventory and merchandising decisions." empty={!data.kmeans.products.length}><ResponsiveContainer {...chartProps}><ScatterChart><CartesianGrid/><XAxis type="number" dataKey="price" name="Price" unit=" THB"/><YAxis type="number" dataKey="stock" name="Stock"/><Tooltip cursor={{strokeDasharray:'3 3'}} content={<ProductTooltip/>}/>{data.kmeans.clusters.map((cluster,i)=><Scatter key={cluster.cluster} name={`Cluster ${cluster.cluster}`} data={data.kmeans.products.filter(p=>p.cluster===cluster.cluster)} fill={colors[i]}/>)}</ScatterChart></ResponsiveContainer></Chart>
  </div>
  <section className="cluster-cards">{data.kmeans.clusters.map((c,i)=><article key={c.cluster} style={{borderTopColor:colors[i]}}><span>Cluster {c.cluster}</span><h4>{c.label}</h4><dl><div><dt>Products</dt><dd>{c.product_count}</dd></div><div><dt>Average price</dt><dd>{money.format(c.average_price)}</dd></div><div><dt>Average stock</dt><dd>{c.average_stock}</dd></div></dl></article>)}</section>
  <div className="analytics-lower">
   <section className="admin-section"><Heading eyebrow="TOP PRODUCTS" title="Top selling products"/><div className="top-products">{data.top_products.length?data.top_products.map((p,i)=><article key={`${p.business}-${p.product_id}`}><b>{i+1}</b><div><strong>{p.name}</strong><span>{p.business}</span></div><dl><div><dt>Sold</dt><dd>{p.quantity_sold}</dd></div><div><dt>Revenue</dt><dd>{money.format(p.revenue)}</dd></div></dl></article>):<Empty/>}</div></section>
   <section className="admin-section"><Heading eyebrow="DECISION SUPPORT" title="Business insights"/><ul className="business-insights">{data.insights.map(x=><li key={x}>{x}</li>)}</ul></section>
  </div>
  <section className="admin-section"><Heading eyebrow="LATEST ACTIVITY" title="Recent orders"/><RecentOrders orders={data.recent_orders} onOpen={onOpen}/></section>
 </div>;
}

function Chart({title,subtitle,action,children,empty,className=''}:{title:string;subtitle?:string;action?:React.ReactNode;children:React.ReactNode;empty:boolean;className?:string}){return <section className={`analytics-card ${className}`}><header><div><p className="eyebrow">ANALYTICS</p><h3>{title}</h3>{subtitle&&<p>{subtitle}</p>}</div>{action}</header><div className="chart-area">{empty?<Empty/>:children}</div></section>}
function Empty(){return <div className="analytics-empty">No recorded data yet.</div>}
function Heading({eyebrow,title}:{eyebrow:string;title:string}){return <div className="admin-section-heading"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div></div>}
function ProductTooltip({active,payload}:{active?:boolean;payload?:Array<{payload:{name:string;business:string;price:number;stock:number;cluster:number}}>}){const p=payload?.[0]?.payload;return active&&p?<div className="analytics-tooltip"><strong>{p.name}</strong><span>{businessNames[p.business]??p.business}</span><span>{money.format(p.price)} · Stock {p.stock}</span><span>Cluster {p.cluster}</span></div>:null}
function RecentOrders({orders,onOpen}:{orders:AdminOrderSummary[];onOpen:(value:string)=>void}){return orders.length?<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th/></tr></thead><tbody>{orders.map(o=><tr key={o.order_no}><td><strong>{o.order_no}</strong></td><td>{o.customer_name}<small>{o.customer_email}</small></td><td>{o.item_count}</td><td>{money.format(o.total)}</td><td>{statusLabel(o.status)}</td><td><button className="text-button" onClick={()=>onOpen(o.order_no)}>Open</button></td></tr>)}</tbody></table></div>:<Empty/>}
