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
import { formatCurrency, formatNumber } from '../utils';
import type { AssetSubtype, AssetCategory } from '../types';

const Assets = () => {
    const assets = useLiveQuery(() => db.assets.toArray());
    const marketData = useLiveQuery(() => db.market_asset_data.toArray());
    const fixedData = useLiveQuery(() => db.fixed_asset_data.toArray());

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
                    { name: formData.name, category: 'fixed', subtype: 'mutual_fund' as any }, // Fixed assets don't have subtypes in requirements but schema needs one
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
                amount: data?.principal.toString() || '',
                interestRate: data?.interest_rate.toString() || '',
                startDate: data?.start_date || ''
            });
        }
    };

    return (
        <div>
            <div className="section-header">
                <h2 style={{ fontSize: '24px' }}>Assets</h2>
                <button onClick={() => setIsAddModalOpen(true)}>Add Asset</button>
            </div>

            <div className="asset-sections">
                <h3 className="section-header" style={{ marginTop: '20px', fontSize: '14px', color: '#a3a3a3' }}>MARKET ASSETS</h3>
                {assets?.filter(a => a.category === 'market').map(asset => {
                    const data = marketData?.find(d => d.asset_id === asset.id);
                    if (!data) return null;
                    const currentValue = data.total_units * data.current_nav;
                    const gain = currentValue - data.total_invested;
                    const isGold = asset.subtype === 'gold';

                    return (
                        <div key={asset.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '24px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <div className="list-item-info">
                                    <h4>{asset.name} <span style={{ fontSize: '11px', color: '#737373', marginLeft: '8px', fontWeight: 500, letterSpacing: '0.05em' }}>{asset.subtype.toUpperCase()}</span></h4>
                                    <p style={{ marginTop: '4px' }}>
                                        {isGold ? 'Quantity' : 'Units'}: {formatNumber(data.total_units, 4)} •
                                        Avg: {formatCurrency(data.avg_cost)} •
                                        {isGold ? 'Rate' : 'NAV'}: {formatCurrency(data.current_nav)}
                                    </p>
                                </div>
                                <div className="list-item-value">
                                    <p style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-0.02em' }}>{formatCurrency(currentValue)}</p>
                                    <p style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: gain >= 0 ? '#000000' : '#737373' }}>
                                        {gain >= 0 ? '+' : ''}{formatCurrency(gain)}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                                <button style={{ padding: '6px 14px', fontSize: '11px', background: 'black', color: 'white' }} onClick={() => setIsActionModalOpen({ type: 'invest', assetId: asset.id })}>Invest</button>
                                <button style={{ padding: '6px 14px', fontSize: '11px', background: 'white', color: 'black', border: '1px solid #000' }} onClick={() => setIsActionModalOpen({ type: 'sell', assetId: asset.id })}>Sell</button>
                                <button style={{ padding: '6px 14px', fontSize: '11px', background: 'transparent', color: 'black', border: '1px solid #f0f0f0' }} onClick={() => setIsActionModalOpen({ type: 'nav', assetId: asset.id })}>Update {isGold ? 'Rate' : 'NAV'}</button>
                                <button style={{ padding: '6px 14px', fontSize: '11px', background: 'transparent', color: 'black', border: '1px solid #f0f0f0' }} onClick={() => openEditModal(asset.id)}>Edit</button>
                                <button style={{ padding: '6px 14px', fontSize: '11px', background: 'transparent', color: '#ff4444', border: '1px solid #fff0f0' }} onClick={() => handleDeleteAsset(asset.id)}>Delete</button>
                            </div>
                        </div>
                    );
                })}

                <h3 className="section-header" style={{ marginTop: '40px', fontSize: '14px', color: '#a3a3a3' }}>FIXED ASSETS</h3>
                {assets?.filter(a => a.category === 'fixed').map(asset => {
                    const data = fixedData?.find(d => d.asset_id === asset.id);
                    if (!data) return null;
                    const currentValue = calculateAccruedInterest(data.principal, data.interest_rate, data.start_date);

                    return (
                        <div key={asset.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <div className="list-item-info">
                                    <h4>{asset.name}</h4>
                                    <p>Principal: {formatCurrency(data.principal)} • Rate: {data.interest_rate}%</p>
                                </div>
                                <div className="list-item-value">
                                    <p style={{ fontWeight: 800, fontSize: '18px' }}>{formatCurrency(currentValue)}</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button style={{ padding: '5px 10px', fontSize: '12px', background: 'white', color: 'black', border: '1px solid #e5e5e5' }} onClick={() => openEditModal(asset.id)}>Edit</button>
                                <button style={{ padding: '5px 10px', fontSize: '12px', background: 'white', color: '#ff4444', border: '1px solid #ff4444' }} onClick={() => handleDeleteAsset(asset.id)}>Delete</button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add Asset Modal */}
            {
                isAddModalOpen && (
                    <div className="modal-overlay">
                        <div className="modal">
                            <div className="modal-header"><h3>Add Asset</h3></div>
                            <form onSubmit={handleAddAsset}>
                                <div className="toggle-group">
                                    <button type="button" className={formData.category === 'market' ? 'active' : ''} onClick={() => setFormData({ ...formData, category: 'market' })}>Market</button>
                                    <button type="button" className={formData.category === 'fixed' ? 'active' : ''} onClick={() => setFormData({ ...formData, category: 'fixed' })}>Fixed</button>
                                </div>

                                <div className="form-group"><label>Asset Name</label><input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></div>

                                {formData.category === 'market' ? (
                                    <>
                                        <div className="form-group">
                                            <label>Subtype</label>
                                            <select value={formData.subtype} onChange={e => setFormData({ ...formData, subtype: e.target.value as any })}>
                                                <option value="mutual_fund">Mutual Fund</option>
                                                <option value="share">Share</option>
                                                <option value="gold">Physical Gold</option>
                                            </select>
                                        </div>
                                        <div className="toggle-group">
                                            <button type="button" className={formData.mode === 'new' ? 'active' : ''} onClick={() => setFormData({ ...formData, mode: 'new' })}>New Investment</button>
                                            <button type="button" className={formData.mode === 'existing' ? 'active' : ''} onClick={() => setFormData({ ...formData, mode: 'existing' })}>Existing Holding</button>
                                        </div>
                                        {formData.mode === 'existing' && (
                                            <div className="form-group"><label>{formData.subtype === 'gold' ? 'Quantity (grams)' : 'Total Units'}</label><input type="number" step="0.0001" value={formData.units} onChange={e => setFormData({ ...formData, units: e.target.value })} required /></div>
                                        )}
                                        <div className="form-group"><label>{formData.mode === 'existing' ? 'Total Invested Amount' : 'Investment Amount'}</label><input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required /></div>
                                        <div className="form-group"><label>{formData.subtype === 'gold' ? 'Gold Rate (per gram)' : 'Current NAV'}</label><input type="number" step="0.0001" value={formData.nav} onChange={e => setFormData({ ...formData, nav: e.target.value })} required /></div>
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
                )
            }

            {/* Edit Asset Modal */}
            {
                isEditModalOpen && (
                    <div className="modal-overlay">
                        <div className="modal">
                            <div className="modal-header"><h3>Edit Asset</h3></div>
                            <form onSubmit={handleEditAsset}>
                                <div className="form-group"><label>Asset Name</label><input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></div>

                                {formData.category === 'market' ? (
                                    <>
                                        <div className="form-group"><label>{formData.subtype === 'gold' ? 'Quantity (grams)' : 'Total Units'}</label><input type="number" step="0.0001" value={formData.units} onChange={e => setFormData({ ...formData, units: e.target.value })} required /></div>
                                        <div className="form-group"><label>Total Invested Amount</label><input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required /></div>
                                        <div className="form-group"><label>{formData.subtype === 'gold' ? 'Gold Rate (per gram)' : 'Current NAV'}</label><input type="number" step="0.0001" value={formData.nav} onChange={e => setFormData({ ...formData, nav: e.target.value })} required /></div>
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
                )
            }

            {/* Action Modals (Invest/Sell/NAV) */}
            {
                isActionModalOpen && (
                    <div className="modal-overlay">
                        <div className="modal">
                            <div className="modal-header"><h3>{isActionModalOpen?.type.toUpperCase()}</h3></div>
                            <form onSubmit={handleAction}>
                                {isActionModalOpen?.type === 'invest' && (
                                    <div className="form-group"><label>Amount</label><input type="number" value={actionData.amount} onChange={e => setActionData({ ...actionData, amount: e.target.value })} required /></div>
                                )}
                                {isActionModalOpen?.type === 'sell' && (
                                    <div className="form-group"><label>Units to Sell</label><input type="number" step="0.0001" value={actionData.units} onChange={e => setActionData({ ...actionData, units: e.target.value })} required /></div>
                                )}
                                <div className="form-group"><label>{assets?.find(a => a.id === isActionModalOpen?.assetId)?.subtype === 'gold' ? 'Gold Rate (per gram)' : 'NAV'}</label><input type="number" step="0.0001" value={actionData.nav} onChange={e => setActionData({ ...actionData, nav: e.target.value })} required /></div>

                                <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                                    <button type="submit" style={{ flex: 1 }}>Confirm</button>
                                    <button type="button" style={{ flex: 1, background: 'white', color: 'black', border: '1px solid #e5e5e5' }} onClick={() => setIsActionModalOpen(null)}>Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Assets;
