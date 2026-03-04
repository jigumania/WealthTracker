import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
    addAsset,
    investInAsset,
    sellAsset,
    updateNAV,
    addFixedAsset,
    calculateAccruedInterest,
    deleteAsset,
    updateAssetBasic,
    updateMarketAssetDetails,
    updateFixedAssetDetails
} from '../logic';
import { formatCurrency, formatNumber, formatSubtype } from '../utils';
import type { AssetSubtype, AssetCategory } from '../types';

const Assets = () => {
    const assets = useLiveQuery(() => db.assets.toArray());
    const marketData = useLiveQuery(() => db.market_asset_data.toArray());
    const fixedData = useLiveQuery(() => db.fixed_asset_data.toArray());

    const [view, setView] = useState<'summary' | 'detail'>('summary');
    const [selectedGroup, setSelectedGroup] = useState<{ category: AssetCategory, subtype: AssetSubtype } | null>(null);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isActionModalOpen, setIsActionModalOpen] = useState<{ type: 'invest' | 'sell' | 'nav', assetId: string } | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        category: 'market' as AssetCategory,
        subtype: 'mutual_fund' as AssetSubtype,
        mode: 'new' as 'new' | 'existing',
        units: '',
        amount: '',
        nav: '',
        interestRate: '',
        startDate: new Date().toISOString().split('T')[0]
    });

    const [actionData, setActionData] = useState({ amount: '', units: '', nav: '' });

    const handleAddAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.category === 'market') {
                await addAsset(
                    { name: formData.name, category: 'market', subtype: formData.subtype },
                    {
                        mode: formData.mode,
                        units: parseFloat(formData.units || '0'),
                        amount: parseFloat(formData.amount || '0'),
                        nav: parseFloat(formData.nav || '0')
                    }
                );
            } else {
                await addFixedAsset(
                    { name: formData.name, category: 'fixed', subtype: formData.subtype },
                    {
                        principal: parseFloat(formData.amount || '0'),
                        interest_rate: parseFloat(formData.interestRate || '0'),
                        start_date: formData.startDate
                    }
                );
            }
            setIsAddModalOpen(false);
            resetForm();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '', category: 'market', subtype: 'mutual_fund', mode: 'new',
            units: '', amount: '', nav: '', interestRate: '', startDate: new Date().toISOString().split('T')[0]
        });
    };

    const handleAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isActionModalOpen) return;
        try {
            if (isActionModalOpen.type === 'invest') {
                await investInAsset(isActionModalOpen.assetId, parseFloat(actionData.amount), parseFloat(actionData.nav));
            } else if (isActionModalOpen.type === 'sell') {
                await sellAsset(isActionModalOpen.assetId, parseFloat(actionData.units), parseFloat(actionData.nav));
            } else if (isActionModalOpen.type === 'nav') {
                await updateNAV(isActionModalOpen.assetId, parseFloat(actionData.nav));
            }
            setIsActionModalOpen(null);
            setActionData({ amount: '', units: '', nav: '' });
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleDeleteAsset = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this asset? This cannot be undone.')) {
            await deleteAsset(id);
        }
    };

    const handleEditAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEditModalOpen) return;
        try {
            await updateAssetBasic(isEditModalOpen, formData.name);
            if (formData.category === 'market') {
                await updateMarketAssetDetails(isEditModalOpen, {
                    total_units: parseFloat(formData.units),
                    total_invested: parseFloat(formData.amount),
                    current_nav: parseFloat(formData.nav),
                    avg_cost: parseFloat(formData.units) > 0 ? parseFloat(formData.amount) / parseFloat(formData.units) : 0
                });
            } else {
                await updateFixedAssetDetails(isEditModalOpen, {
                    principal: parseFloat(formData.amount),
                    interest_rate: parseFloat(formData.interestRate),
                    start_date: formData.startDate
                });
            }
            setIsEditModalOpen(null);
            resetForm();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const openEditModal = (assetId: string) => {
        const asset = assets?.find(a => a.id === assetId);
        if (!asset) return;
        setIsEditModalOpen(assetId);
        if (asset.category === 'market') {
            const data = marketData?.find(d => d.asset_id === assetId);
            setFormData({
                ...formData,
                name: asset.name,
                category: asset.category,
                subtype: asset.subtype,
                units: data?.total_units.toString() || '',
                amount: data?.total_invested.toString() || '',
                nav: data?.current_nav.toString() || ''
            });
        } else {
            const data = fixedData?.find(d => d.asset_id === assetId);
            setFormData({
                ...formData,
                name: asset.name,
                category: asset.category,
                subtype: asset.subtype,
                amount: data?.principal.toString() || '',
                interestRate: data?.interest_rate.toString() || '',
                startDate: data?.start_date || ''
            });
        }
    };

    // Calculate grouped summary
    const groups = assets?.reduce((acc, asset) => {
        const key = `${asset.category}-${asset.subtype}`;
        if (!acc[key]) {
            acc[key] = {
                category: asset.category,
                subtype: asset.subtype,
                totalValue: 0,
                totalInvested: 0,
                totalGain: 0,
                count: 0
            };
        }

        if (asset.category === 'market') {
            const data = marketData?.find(d => d.asset_id === asset.id);
            if (data) {
                const val = data.total_units * data.current_nav;
                acc[key].totalValue += val;
                acc[key].totalInvested += data.total_invested;
                acc[key].totalGain += (val - data.total_invested);
                acc[key].count++;
            }
        } else {
            const data = fixedData?.find(d => d.asset_id === asset.id);
            if (data) {
                const val = calculateAccruedInterest(data.principal, data.interest_rate, data.start_date);
                acc[key].totalValue += val;
                acc[key].totalInvested += data.principal;
                acc[key].totalGain += (val - data.principal);
                acc[key].count++;
            }
        }
        return acc;
    }, {} as Record<string, any>);

    const groupedArray = Object.values(groups || {});

    if (view === 'summary') {
        return (
            <div>
                <div className="section-header">
                    <h2 style={{ fontSize: '24px' }}>Assets Summary</h2>
                    <button onClick={() => setIsAddModalOpen(true)}>Add Asset</button>
                </div>

                <div className="asset-sections">
                    <h3 className="section-header" style={{ marginTop: '20px', fontSize: '14px', color: '#a3a3a3' }}>BY ASSET CLASS</h3>
                    {groupedArray.length === 0 ? (
                        <p style={{ color: '#737373', fontSize: '14px', marginTop: '20px' }}>No assets added yet.</p>
                    ) : (
                        groupedArray.map(group => (
                            <div
                                key={`${group.category}-${group.subtype}`}
                                className="list-item"
                                style={{ padding: '24px 0', cursor: 'pointer' }}
                                onClick={() => {
                                    setSelectedGroup({ category: group.category, subtype: group.subtype });
                                    setView('detail');
                                }}
                            >
                                <div className="list-item-info">
                                    <h4>{formatSubtype(group.subtype)}</h4>
                                    <p>{group.count} Asset{group.count !== 1 ? 's' : ''} • {group.category.toUpperCase()}</p>
                                </div>
                                <div className="list-item-value">
                                    <p style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-0.02em' }}>{formatCurrency(group.totalValue)}</p>
                                    <p style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: group.totalGain >= 0 ? '#16a34a' : '#dc2626' }}>
                                        {group.totalGain >= 0 ? '+' : ''}{formatCurrency(group.totalGain)}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {isAddModalOpen && renderAddModal()}
            </div>
        );
    }

    // Detail View
    const filteredAssets = assets?.filter(a => a.category === selectedGroup?.category && a.subtype === selectedGroup?.subtype);

    return (
        <div>
            <div className="section-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        style={{ padding: '8px 4px', background: 'transparent', color: 'black', border: 'none', borderBottom: '1px solid black', borderRadius: 0 }}
                        onClick={() => setView('summary')}
                    >
                        ← Back
                    </button>
                    <h2 style={{ fontSize: '24px' }}>{formatSubtype(selectedGroup?.subtype || '')}</h2>
                </div>
                <button onClick={() => setIsAddModalOpen(true)}>Add Asset</button>
            </div>

            <div className="asset-list">
                {filteredAssets?.map(asset => {
                    if (asset.category === 'market') {
                        const data = marketData?.find(d => d.asset_id === asset.id);
                        if (!data) return null;
                        const currentValue = data.total_units * data.current_nav;
                        const gain = currentValue - data.total_invested;
                        const isGold = asset.subtype === 'gold';
                        const isSilver = asset.subtype === 'silver';

                        return (
                            <div key={asset.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '24px 0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                    <div className="list-item-info">
                                        <h4>{asset.name}</h4>
                                        <p style={{ marginTop: '4px' }}>
                                            {(isGold || isSilver) ? 'Quantity' : 'Units'}: {formatNumber(data.total_units, 4)} •
                                            Avg: {formatCurrency(data.avg_cost)} •
                                            {(isGold || isSilver) ? 'Rate' : 'NAV'}: {formatCurrency(data.current_nav)}
                                        </p>
                                    </div>
                                    <div className="list-item-value">
                                        <p style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-0.02em' }}>{formatCurrency(currentValue)}</p>
                                        <p style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: gain >= 0 ? '#16a34a' : '#dc2626' }}>
                                            {gain >= 0 ? '+' : ''}{formatCurrency(gain)}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                                    <button style={{ padding: '6px 14px', fontSize: '11px', background: 'black', color: 'white' }} onClick={() => setIsActionModalOpen({ type: 'invest', assetId: asset.id })}>Invest</button>
                                    <button style={{ padding: '6px 14px', fontSize: '11px', background: 'white', color: 'black', border: '1px solid #000' }} onClick={() => setIsActionModalOpen({ type: 'sell', assetId: asset.id })}>Sell</button>
                                    <button style={{ padding: '6px 14px', fontSize: '11px', background: 'transparent', color: 'black', border: '1px solid #f0f0f0' }} onClick={() => setIsActionModalOpen({ type: 'nav', assetId: asset.id })}>Update {(isGold || isSilver) ? 'Rate' : 'NAV'}</button>
                                    <button style={{ padding: '6px 14px', fontSize: '11px', background: 'transparent', color: 'black', border: '1px solid #f0f0f0' }} onClick={() => openEditModal(asset.id)}>Edit</button>
                                    <button style={{ padding: '6px 14px', fontSize: '11px', background: 'transparent', color: '#ff4444', border: '1px solid #fff0f0' }} onClick={() => handleDeleteAsset(asset.id)}>Delete</button>
                                </div>
                            </div>
                        );
                    } else {
                        const data = fixedData?.find(d => d.asset_id === asset.id);
                        if (!data) return null;
                        const currentValue = calculateAccruedInterest(data.principal, data.interest_rate, data.start_date);
                        const gain = currentValue - data.principal;

                        return (
                            <div key={asset.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '24px 0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                    <div className="list-item-info">
                                        <h4>{asset.name}</h4>
                                        <p style={{ marginTop: '4px' }}>Principal: {formatCurrency(data.principal)} • Rate: {data.interest_rate}% • Date: {data.start_date}</p>
                                    </div>
                                    <div className="list-item-value">
                                        <p style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-0.02em' }}>{formatCurrency(currentValue)}</p>
                                        <p style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: '#16a34a' }}>
                                            +{formatCurrency(gain)}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                                    <button style={{ padding: '6px 14px', fontSize: '11px', background: 'transparent', color: 'black', border: '1px solid #f0f0f0' }} onClick={() => openEditModal(asset.id)}>Edit</button>
                                    <button style={{ padding: '6px 14px', fontSize: '11px', background: 'transparent', color: '#ff4444', border: '1px solid #fff0f0' }} onClick={() => handleDeleteAsset(asset.id)}>Delete</button>
                                </div>
                            </div>
                        );
                    }
                })}
            </div>

            {isAddModalOpen && renderAddModal()}
            {isEditModalOpen && renderEditModal()}
            {isActionModalOpen && renderActionModal()}
        </div>
    );

    function renderAddModal() {
        return (
            <div className="modal-overlay">
                <div className="modal">
                    <div className="modal-header"><h3>Add Asset</h3></div>
                    <form onSubmit={handleAddAsset}>
                        <div className="toggle-group">
                            <button type="button" className={formData.category === 'market' ? 'active' : ''} onClick={() => setFormData({ ...formData, category: 'market', subtype: 'mutual_fund' })}>Market</button>
                            <button type="button" className={formData.category === 'fixed' ? 'active' : ''} onClick={() => setFormData({ ...formData, category: 'fixed', subtype: 'fd' })}>Fixed</button>
                        </div>

                        <div className="form-group"><label>Asset Name</label><input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></div>

                        <div className="form-group">
                            <label>Subtype</label>
                            <select value={formData.subtype} onChange={e => setFormData({ ...formData, subtype: e.target.value as any })}>
                                {formData.category === 'market' ? (
                                    <>
                                        <option value="mutual_fund">Mutual Fund</option>
                                        <option value="share">Equity Share</option>
                                        <option value="gold">Physical Gold</option>
                                        <option value="silver">Physical Silver</option>
                                        <option value="other_market">Other Market Asset</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="fd">Fixed Deposit (FD)</option>
                                        <option value="epf">EPF</option>
                                        <option value="ppf">PPF</option>
                                        <option value="bond">Bond</option>
                                        <option value="other_fixed">Other Fixed Asset</option>
                                    </>
                                )}
                            </select>
                        </div>

                        {formData.category === 'market' ? (
                            <>
                                <div className="toggle-group">
                                    <button type="button" className={formData.mode === 'new' ? 'active' : ''} onClick={() => setFormData({ ...formData, mode: 'new' })}>New Investment</button>
                                    <button type="button" className={formData.mode === 'existing' ? 'active' : ''} onClick={() => setFormData({ ...formData, mode: 'existing' })}>Existing Holding</button>
                                </div>
                                {formData.mode === 'existing' && (
                                    <div className="form-group"><label>{['gold', 'silver'].includes(formData.subtype) ? 'Quantity (grams)' : 'Total Units'}</label><input type="number" step="0.0001" value={formData.units} onChange={e => setFormData({ ...formData, units: e.target.value })} required /></div>
                                )}
                                <div className="form-group"><label>{formData.mode === 'existing' ? 'Total Invested Amount' : 'Investment Amount'}</label><input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required /></div>
                                <div className="form-group"><label>{['gold', 'silver'].includes(formData.subtype) ? 'Gold/Silver Rate (per gram)' : 'Current NAV/Price'}</label><input type="number" step="0.0001" value={formData.nav} onChange={e => setFormData({ ...formData, nav: e.target.value })} required /></div>
                            </>
                        ) : (
                            <>
                                <div className="form-group"><label>Principal Amount</label><input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required /></div>
                                <div className="form-group"><label>Interest Rate (%)</label><input type="number" step="0.1" value={formData.interestRate} onChange={e => setFormData({ ...formData, interestRate: e.target.value })} required /></div>
                                <div className="form-group"><label>Start Date</label><input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} required /></div>
                            </>
                        )}

                        <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                            <button type="submit" style={{ flex: 1 }}>Add</button>
                            <button type="button" style={{ flex: 1, background: 'white', color: 'black', border: '1px solid #e5e5e5' }} onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    function renderEditModal() {
        return (
            <div className="modal-overlay">
                <div className="modal">
                    <div className="modal-header"><h3>Edit Asset</h3></div>
                    <form onSubmit={handleEditAsset}>
                        <div className="form-group"><label>Asset Name</label><input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></div>

                        {formData.category === 'market' ? (
                            <>
                                <div className="form-group"><label>{['gold', 'silver'].includes(formData.subtype) ? 'Quantity (grams)' : 'Total Units'}</label><input type="number" step="0.0001" value={formData.units} onChange={e => setFormData({ ...formData, units: e.target.value })} required /></div>
                                <div className="form-group"><label>Total Invested Amount</label><input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required /></div>
                                <div className="form-group"><label>{['gold', 'silver'].includes(formData.subtype) ? 'Rate (per gram)' : 'Current NAV/Price'}</label><input type="number" step="0.0001" value={formData.nav} onChange={e => setFormData({ ...formData, nav: e.target.value })} required /></div>
                            </>
                        ) : (
                            <>
                                <div className="form-group"><label>Principal Amount</label><input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required /></div>
                                <div className="form-group"><label>Interest Rate (%)</label><input type="number" step="0.1" value={formData.interestRate} onChange={e => setFormData({ ...formData, interestRate: e.target.value })} required /></div>
                                <div className="form-group"><label>Start Date</label><input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} required /></div>
                            </>
                        )}

                        <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                            <button type="submit" style={{ flex: 1 }}>Save</button>
                            <button type="button" style={{ flex: 1, background: 'white', color: 'black', border: '1px solid #e5e5e5' }} onClick={() => setIsEditModalOpen(null)}>Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    function renderActionModal() {
        const asset = assets?.find(a => a.id === isActionModalOpen?.assetId);
        const isBullion = asset?.subtype === 'gold' || asset?.subtype === 'silver';

        return (
            <div className="modal-overlay">
                <div className="modal">
                    <div className="modal-header"><h3>{isActionModalOpen?.type.toUpperCase()}</h3></div>
                    <form onSubmit={handleAction}>
                        {isActionModalOpen?.type === 'invest' && (
                            <div className="form-group"><label>Amount</label><input type="number" value={actionData.amount} onChange={e => setActionData({ ...actionData, amount: e.target.value })} required /></div>
                        )}
                        {isActionModalOpen?.type === 'sell' && (
                            <div className="form-group"><label>{isBullion ? 'grams to Sell' : 'Units to Sell'}</label><input type="number" step="0.0001" value={actionData.units} onChange={e => setActionData({ ...actionData, units: e.target.value })} required /></div>
                        )}
                        <div className="form-group"><label>{isBullion ? 'Rate (per gram)' : 'NAV/Price'}</label><input type="number" step="0.0001" value={actionData.nav} onChange={e => setActionData({ ...actionData, nav: e.target.value })} required /></div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                            <button type="submit" style={{ flex: 1 }}>Confirm</button>
                            <button type="button" style={{ flex: 1, background: 'white', color: 'black', border: '1px solid #e5e5e5' }} onClick={() => setIsActionModalOpen(null)}>Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }
};

export default Assets;
