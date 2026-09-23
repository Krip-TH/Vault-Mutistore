import { useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { formatTHB } from '../../format';
import { colors, serif } from '../../theme';
import type { AdminAnalytics, AdminOrderSummary } from '../../types';

const palette = ['#294638', '#8f6846', '#c1a86d', '#71806f', '#b96f56', '#4f6b78'];
const businessNames: Record<string, string> = {
  door: 'Door', plug: 'Electrical Plug', brandname: 'Brandname', clothing: 'Clothing', powerbank: 'Powerbank', projector: 'Projector',
};
const statusLabel = (value: string) => (value === 'completed' ? 'Completed' : value[0].toUpperCase() + value.slice(1));
const screenWidth = Dimensions.get('window').width;

const chartConfig = {
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(41, 70, 56, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(90, 97, 87, ${opacity})`,
  propsForDots: { r: '3' },
  propsForBackgroundLines: { stroke: '#e3e1d6' },
  barPercentage: 0.6,
};

export default function AdminAnalyticsView({ data, onOpenOrder }: { data: AdminAnalytics; onOpenOrder: (orderNo: string) => void }) {
  const [period, setPeriod] = useState<'7' | '30' | 'all'>('30');
  const trend = useMemo(
    () => (period === 'all' ? data.revenue_trend : data.revenue_trend.slice(-Number(period))),
    [data.revenue_trend, period],
  );

  const kpis: Array<[string, string]> = [
    ['Total revenue', formatTHB(data.kpis.total_revenue)],
    ['Total orders', String(data.kpis.total_orders)],
    ['Total customers', String(data.kpis.total_customers)],
    ['Average order value', formatTHB(data.kpis.average_order_value)],
    ['Total products', String(data.kpis.total_products)],
    ['In stock', String(data.kpis.in_stock)],
    ['Low stock', String(data.kpis.low_stock)],
    ['Out of stock', String(data.kpis.out_of_stock)],
  ];

  const trendWidth = Math.max(screenWidth - 40, trend.length * 60);
  const revenueByBusiness = data.revenue_by_business.map(item => ({ ...item, name: businessNames[item.business] ?? item.business }));
  const revenueWidth = Math.max(screenWidth - 40, revenueByBusiness.length * 90);
  const statusData = data.order_statuses.map(item => ({ ...item, name: statusLabel(item.status) }));
  const statusWidth = Math.max(screenWidth - 40, statusData.length * 80);
  const productsByBusinessWidth = Math.max(screenWidth - 40, data.products_by_business.length * 80);

  const inventoryPie = data.inventory.map((item, index) => ({
    name: item.status, count: item.count, color: palette[index % palette.length],
    legendFontColor: colors.muted, legendFontSize: 11,
  }));

  return (
    <View>
      <View style={styles.kpiGrid}>
        {kpis.map(([label, value]) => (
          <View key={label} style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>{label}</Text>
            <Text style={styles.kpiValue}>{value}</Text>
          </View>
        ))}
      </View>

      {data.warnings.length > 0 && (
        <View style={styles.warning}>
          <Text style={styles.warningTitle}>Partial inventory data</Text>
          {data.warnings.map((warning, index) => <Text key={index} style={styles.warningBody}>{warning}</Text>)}
        </View>
      )}

      <ChartCard
        title="Revenue Trend"
        empty={!trend.length}
        action={
          <View style={styles.periodTabs}>
            {(['7', '30', 'all'] as const).map(value => (
              <Pressable key={value} onPress={() => setPeriod(value)} style={[styles.periodTab, period === value && styles.periodTabActive]}>
                <Text style={[styles.periodTabText, period === value && styles.periodTabTextActive]}>{value === 'all' ? 'All' : `${value}d`}</Text>
              </Pressable>
            ))}
          </View>
        }
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <LineChart
            data={{ labels: trend.map(point => point.date.slice(5)), datasets: [{ data: trend.map(point => point.revenue) }] }}
            width={trendWidth}
            height={200}
            chartConfig={chartConfig}
            bezier
            fromZero
            style={styles.chart}
          />
        </ScrollView>
      </ChartCard>

      <ChartCard title="Revenue by Business" empty={!revenueByBusiness.length}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <BarChart
            data={{ labels: revenueByBusiness.map(item => item.name), datasets: [{ data: revenueByBusiness.map(item => item.revenue) }] }}
            width={revenueWidth}
            height={200}
            chartConfig={chartConfig}
            fromZero
            yAxisLabel=""
            yAxisSuffix=""
            style={styles.chart}
          />
        </ScrollView>
      </ChartCard>

      <ChartCard title="Inventory / Stock Health" empty={!inventoryPie.length}>
        <PieChart
          data={inventoryPie}
          width={screenWidth - 40}
          height={200}
          chartConfig={chartConfig}
          accessor="count"
          backgroundColor="transparent"
          paddingLeft="12"
        />
      </ChartCard>

      <ChartCard title="Products by Business" empty={!data.products_by_business.length}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <BarChart
            data={{ labels: data.products_by_business.map(item => item.name), datasets: [{ data: data.products_by_business.map(item => item.count) }] }}
            width={productsByBusinessWidth}
            height={190}
            chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(143, 104, 70, ${opacity})` }}
            fromZero
            yAxisLabel=""
            yAxisSuffix=""
            style={styles.chart}
          />
        </ScrollView>
      </ChartCard>

      <ChartCard title="Order Status Analytics" empty={!statusData.length}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <BarChart
            data={{ labels: statusData.map(item => item.name), datasets: [{ data: statusData.map(item => item.count) }] }}
            width={statusWidth}
            height={190}
            chartConfig={chartConfig}
            fromZero
            yAxisLabel=""
            yAxisSuffix=""
            style={styles.chart}
          />
        </ScrollView>
      </ChartCard>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>ANALYTICS</Text>
        <Text style={styles.cardTitle}>K-Means Product Segmentation</Text>
        <Text style={styles.cardSubtitle}>
          K-Means groups products with similar price and inventory characteristics to support inventory and merchandising decisions.
        </Text>
        {data.kmeans.clusters.length === 0 ? (
          <Text style={styles.emptyText}>No recorded data yet.</Text>
        ) : (
          <View style={styles.clusterGrid}>
            {data.kmeans.clusters.map((cluster, index) => (
              <View key={cluster.cluster} style={[styles.clusterCard, { borderTopColor: palette[index % palette.length] }]}>
                <Text style={styles.clusterLabel}>Cluster {cluster.cluster}</Text>
                <Text style={styles.clusterTitle}>{cluster.label}</Text>
                <View style={styles.factRow}><Text style={styles.factLabel}>Products</Text><Text style={styles.factValue}>{cluster.product_count}</Text></View>
                <View style={styles.factRow}><Text style={styles.factLabel}>Avg. price</Text><Text style={styles.factValue}>{formatTHB(cluster.average_price)}</Text></View>
                <View style={styles.factRow}><Text style={styles.factLabel}>Avg. stock</Text><Text style={styles.factValue}>{cluster.average_stock}</Text></View>
              </View>
            ))}
          </View>
        )}
        <Text style={styles.chartNote}>
          Note: the price-vs-stock scatter plot from the web dashboard is not rendered here — the mobile chart
          library used for this pilot doesn't support scatter charts. The cluster summary above carries the same data.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>TOP PRODUCTS</Text>
        <Text style={styles.cardTitle}>Top selling products</Text>
        {data.top_products.length === 0 ? <Text style={styles.emptyText}>No recorded data yet.</Text> : data.top_products.map((product, index) => (
          <View key={`${product.business}-${product.product_id}`} style={styles.topProductRow}>
            <Text style={styles.topProductRank}>{index + 1}</Text>
            <View style={styles.reviewBody}>
              <Text style={styles.orderRowStrong}>{product.name}</Text>
              <Text style={styles.orderRowSmall}>{businessNames[product.business] ?? product.business}</Text>
            </View>
            <View style={styles.topProductFacts}>
              <Text style={styles.orderRowSmall}>Sold {product.quantity_sold}</Text>
              <Text style={styles.orderRowStrong}>{formatTHB(product.revenue)}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>DECISION SUPPORT</Text>
        <Text style={styles.cardTitle}>Business insights</Text>
        {data.insights.map((insight, index) => <Text key={index} style={styles.insightItem}>• {insight}</Text>)}
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>LATEST ACTIVITY</Text>
        <Text style={styles.cardTitle}>Recent orders</Text>
        {data.recent_orders.length === 0 ? <Text style={styles.emptyText}>No recorded data yet.</Text> : data.recent_orders.map(order => (
          <RecentOrderRow key={order.order_no} order={order} onOpen={onOpenOrder} />
        ))}
      </View>
    </View>
  );
}

function ChartCard({ title, action, children, empty }: { title: string; action?: React.ReactNode; children: React.ReactNode; empty: boolean }) {
  return (
    <View style={styles.card}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.eyebrow}>ANALYTICS</Text>
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        {action}
      </View>
      {empty ? <Text style={styles.emptyText}>No recorded data yet.</Text> : children}
    </View>
  );
}

function RecentOrderRow({ order, onOpen }: { order: AdminOrderSummary; onOpen: (orderNo: string) => void }) {
  return (
    <Pressable style={styles.orderRow} onPress={() => onOpen(order.order_no)}>
      <View style={styles.reviewBody}>
        <Text style={styles.orderRowStrong}>{order.order_no}</Text>
        <Text style={styles.orderRowSmall}>{order.customer_name}</Text>
      </View>
      <View style={styles.topProductFacts}>
        <Text style={styles.orderRowSmall}>{statusLabel(order.status)}</Text>
        <Text style={styles.orderRowStrong}>{formatTHB(order.total)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  kpiCard: { width: '47%', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, padding: 14 },
  kpiLabel: { fontSize: 10, color: colors.muted, marginBottom: 6 },
  kpiValue: { fontSize: 18, fontWeight: '600', color: colors.text },
  warning: { backgroundColor: '#faf3e6', borderRadius: 10, padding: 12, marginBottom: 16 },
  warningTitle: { fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 4 },
  warningBody: { fontSize: 11, color: colors.muted },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 14, padding: 16, marginBottom: 16 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  eyebrow: { fontSize: 9, fontWeight: '600', letterSpacing: 1.5, color: colors.muted },
  cardTitle: { fontFamily: serif, fontSize: 18, color: colors.text, marginTop: 4 },
  cardSubtitle: { fontSize: 11, color: colors.muted, marginTop: 6, marginBottom: 12, lineHeight: 16 },
  chart: { borderRadius: 12 },
  periodTabs: { flexDirection: 'row', gap: 6 },
  periodTab: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#eeece4' },
  periodTabActive: { backgroundColor: colors.darkGreen },
  periodTabText: { fontSize: 10, color: colors.text },
  periodTabTextActive: { color: '#fff' },
  emptyText: { fontSize: 12, color: colors.muted, textAlign: 'center', paddingVertical: 20 },
  clusterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  clusterCard: { width: '47%', borderTopWidth: 3, backgroundColor: '#faf9f5', borderRadius: 10, padding: 12 },
  clusterLabel: { fontSize: 9, color: colors.muted, textTransform: 'uppercase' },
  clusterTitle: { fontFamily: serif, fontSize: 14, color: colors.text, marginTop: 4, marginBottom: 8 },
  factRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  factLabel: { fontSize: 10, color: colors.muted },
  factValue: { fontSize: 11, color: colors.text, fontWeight: '500' },
  chartNote: { fontSize: 10, color: colors.muted, marginTop: 14, lineHeight: 15, fontStyle: 'italic' },
  topProductRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.headerBorder },
  topProductRank: { fontFamily: serif, fontSize: 16, color: colors.muted, width: 20 },
  reviewBody: { flex: 1, gap: 2 },
  topProductFacts: { alignItems: 'flex-end', gap: 2 },
  orderRowSmall: { fontSize: 10, color: colors.muted },
  orderRowStrong: { fontSize: 13, color: colors.text, fontWeight: '500' },
  insightItem: { fontSize: 12, color: colors.text, lineHeight: 20, marginBottom: 4 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.headerBorder },
});
