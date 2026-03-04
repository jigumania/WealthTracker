import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getCashBalances, calculateAccruedInterest } from '../logic';
import { formatCurrency } from '../utils';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

const Dashboard = () => {
    const [balances, setBalances] = useState({ totalCash: 0, parkingBalance: 0, emergencyBalance: 0, availableCash: 0 });
    const marketAssets = useLiveQuery(() => db.market_asset_data.toArray());
    const fixedAssets = useLiveQuery(() => db.fixed_asset_data.toArray());
    const liabilities = useLiveQuery(() => db.liabilities.toArray());
    const snapshots = useLiveQuery(() => db.monthly_snapshots.orderBy('month').toArray());

    useEffect(() => {
        getCashBalances().then(setBalances);
        // Create snapshot for current month if it doesn't exist
        import('../logic').then(m => m.createMonthlySnapshot());
    }, [marketAssets, fixedAssets, liabilities]);

    const marketTotal = marketAssets?.reduce((acc, curr) => acc + (curr.total_units * curr.current_nav), 0) || 0;
    const fixedTotal = fixedAssets?.reduce((acc, curr) => acc + calculateAccruedInterest(curr.principal, curr.interest_rate, curr.start_date), 0) || 0;
    const totalLiabilities = liabilities?.reduce((acc, curr) => acc + curr.outstanding_balance, 0) || 0;
    const totalAssets = balances.totalCash + marketTotal + fixedTotal;
    const netWorth = totalAssets - totalLiabilities;

    return (
        <div>
            <div className="net-worth-display">
                <p className="net-worth-label">Net Worth</p>
                <h1 className="net-worth-amount">{formatCurrency(netWorth)}</h1>
            </div>

            <div className="card-grid">
                <div className="stat-card">
                    <p className="stat-label">Total Assets</p>
                    <p className="stat-value">{formatCurrency(totalAssets)}</p>
                </div>
                <div className="stat-card">
                    <p className="stat-label">Total Liabilities</p>
                    <p className="stat-value">{formatCurrency(totalLiabilities)}</p>
                </div>
                <div className="stat-card">
                    <p className="stat-label">Available Cash</p>
                    <p className="stat-value">{formatCurrency(balances.availableCash)}</p>
                </div>
                <div className="stat-card">
                    <p className="stat-label">Parking</p>
                    <p className="stat-value">{formatCurrency(balances.parkingBalance)}</p>
                </div>
                <div className="stat-card">
                    <p className="stat-label">Emergency Fund</p>
                    <p className="stat-value">{formatCurrency(balances.emergencyBalance)}</p>
                </div>
                <div className="stat-card">
                    <p className="stat-label">Market Assets</p>
                    <p className="stat-value">{formatCurrency(marketTotal)}</p>
                </div>
                <div className="stat-card">
                    <p className="stat-label">Fixed Assets</p>
                    <p className="stat-value">{formatCurrency(fixedTotal)}</p>
                </div>
            </div>


            <div className="divider" />

            <div style={{ width: '100%', height: 350, marginTop: '48px' }}>
                <h3 className="section-header"><span>Net Worth History</span></h3>
                {snapshots && snapshots.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={snapshots}>
                            <XAxis
                                dataKey="month"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11, fill: '#737373', fontWeight: 500 }}
                                dy={10}
                            />
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip
                                contentStyle={{
                                    border: '1px solid #f0f0f0',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                    fontSize: '12px',
                                    fontWeight: 600
                                }}
                                cursor={{ stroke: '#f0f0f0', strokeWidth: 2 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="net_worth"
                                stroke="#000000"
                                strokeWidth={2.5}
                                dot={{ r: 4, fill: '#000000', strokeWidth: 2, stroke: '#ffffff' }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                                animationDuration={1000}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <p style={{ color: '#737373', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>No history data available yet.</p>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
