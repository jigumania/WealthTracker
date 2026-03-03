import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { addLiability, makeLiabilityPayment } from '../logic';
import { formatCurrency } from '../utils';
import type { LiabilityType } from '../types';

const Liabilities = () => {
    const liabilities = useLiveQuery(() => db.liabilities.toArray());
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        type: 'loan' as LiabilityType,
        balance: '',
        rate: ''
    });

    const [payAmount, setPayAmount] = useState('');

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addLiability({
                name: formData.name,
                type: formData.type,
                outstanding_balance: parseFloat(formData.balance),
                interest_rate: parseFloat(formData.rate)
            });
            setIsAddModalOpen(false);
            setFormData({ name: '', type: 'loan', balance: '', rate: '' });
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handlePay = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isPayModalOpen) return;
        try {
            await makeLiabilityPayment(isPayModalOpen, parseFloat(payAmount));
            setIsPayModalOpen(null);
            setPayAmount('');
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div>
            <div className="section-header">
                <h2 style={{ fontSize: '24px' }}>Liabilities</h2>
                <button onClick={() => setIsAddModalOpen(true)}>Add Liability</button>
            </div>

            <div className="liability-sections">
                <h3 className="section-header" style={{ marginTop: '24px', fontSize: '14px', color: '#737373', borderBottom: 'none', paddingBottom: 0 }}>LOANS</h3>
                {liabilities?.filter(l => l.type === 'loan').map(loan => (
                    <div key={loan.id} className="list-item" style={{ padding: '24px 0' }}>
                        <div className="list-item-info">
                            <h4>{loan.name}</h4>
                            <p style={{ marginTop: '4px' }}>Rate: {loan.interest_rate}%</p>
                        </div>
                        <div className="list-item-value" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                            <p style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-0.02em' }}>{formatCurrency(loan.outstanding_balance)}</p>
                            <button
                                style={{ padding: '4px 12px', fontSize: '11px', background: 'transparent', color: 'black', border: '1px solid #f0f0f0' }}
                                onClick={() => setIsPayModalOpen(loan.id)}
                            >
                                Make Payment
                            </button>
                        </div>
                    </div>
                ))}

                <h3 className="section-header" style={{ marginTop: '48px', fontSize: '14px', color: '#737373', borderBottom: 'none', paddingBottom: 0 }}>CREDIT CARDS</h3>
                {liabilities?.filter(l => l.type === 'credit_card').map(card => (
                    <div key={card.id} className="list-item" style={{ padding: '24px 0' }}>
                        <div className="list-item-info">
                            <h4>{card.name}</h4>
                            <p style={{ marginTop: '4px' }}>Rate: {card.interest_rate}%</p>
                        </div>
                        <div className="list-item-value" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                            <p style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-0.02em' }}>{formatCurrency(card.outstanding_balance)}</p>
                            <button
                                style={{ padding: '4px 12px', fontSize: '11px', background: 'transparent', color: 'black', border: '1px solid #f0f0f0' }}
                                onClick={() => setIsPayModalOpen(card.id)}
                            >
                                Make Payment
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {isAddModalOpen && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header"><h3>Add Liability</h3></div>
                        <form onSubmit={handleAdd}>
                            <div className="form-group">
                                <label>Name</label>
                                <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>Type</label>
                                <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}>
                                    <option value="loan">Loan</option>
                                    <option value="credit_card">Credit Card</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Outstanding Balance</label>
                                <input type="number" value={formData.balance} onChange={e => setFormData({ ...formData, balance: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>Interest Rate (%)</label>
                                <input type="number" step="0.1" value={formData.rate} onChange={e => setFormData({ ...formData, rate: e.target.value })} required />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                                <button type="submit" style={{ flex: 1 }}>Add</button>
                                <button type="button" style={{ flex: 1, background: 'white', color: 'black', border: '1px solid #e5e5e5' }} onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isPayModalOpen && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header"><h3>Make Payment</h3></div>
                        <form onSubmit={handlePay}>
                            <div className="form-group">
                                <label>Payment Amount</label>
                                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} required />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                                <button type="submit" style={{ flex: 1 }}>Confirm</button>
                                <button type="button" style={{ flex: 1, background: 'white', color: 'black', border: '1px solid #e5e5e5' }} onClick={() => setIsPayModalOpen(null)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Liabilities;
