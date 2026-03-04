import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getCashBalances, addTransaction, deleteTransaction, updateTransaction } from '../logic';
import { formatCurrency } from '../utils';


const Cash = () => {
    const [balances, setBalances] = useState({ totalCash: 0, parkingBalance: 0, availableCash: 0 });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        type: 'expense' as any,
        amount: '',
        category_id: '',
        date: new Date().toISOString().split('T')[0]
    });

    const ledger = useLiveQuery(() => db.cash_ledger.orderBy('date').reverse().toArray());
    const categories = useLiveQuery(() => db.categories.toArray());

    useEffect(() => {
        getCashBalances().then(setBalances);
    }, [ledger]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addTransaction({
                type: formData.type,
                amount: parseFloat(formData.amount),
                category_id: formData.category_id || undefined,
                date: formData.date
            });
            setIsModalOpen(false);
            setFormData({ ...formData, amount: '', category_id: '' });
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this transaction?')) {
            await deleteTransaction(id);
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEditModalOpen) return;
        try {
            await updateTransaction(isEditModalOpen, {
                amount: parseFloat(formData.amount),
                category_id: formData.category_id || undefined,
                date: formData.date
            });
            setIsEditModalOpen(null);
            setFormData({ ...formData, amount: '', category_id: '' });
        } catch (err: any) {
            alert(err.message);
        }
    };

    const openEditModal = (transaction: any) => {
        setIsEditModalOpen(transaction.id);
        setFormData({
            type: transaction.type,
            amount: transaction.amount.toString(),
            category_id: transaction.category_id || '',
            date: transaction.date
        });
    };

    return (
        <div>
            <div className="section-header">
                <h2 style={{ fontSize: '24px' }}>Cash Ledger</h2>
                <button onClick={() => setIsModalOpen(true)}>Add Transaction</button>
            </div>

            <div className="card-grid">
                <div className="stat-card">
                    <p className="stat-label">Available Cash</p>
                    <p className="stat-value">{formatCurrency(balances.availableCash)}</p>
                </div>
                <div className="stat-card">
                    <p className="stat-label">Parking Balance</p>
                    <p className="stat-value">{formatCurrency(balances.parkingBalance)}</p>
                </div>
            </div>

            <div className="divider" />

            <div className="transaction-list">
                {ledger?.map((entry) => {
                    const category = categories?.find(c => c.id === entry.category_id);
                    return (
                        <div key={entry.id} className="list-item">
                            <div className="list-item-info">
                                <h4>{entry.type.replace(/_/g, ' ').toUpperCase()}</h4>
                                <p>{category?.name || 'No Category'} • {entry.date}</p>
                            </div>
                            <div className="list-item-value" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                <p style={{ fontWeight: 700, fontSize: '18px', color: ['expense', 'invest', 'loan_payment', 'move_to_parking'].includes(entry.type) ? '#dc2626' : '#16a34a' }}>
                                    {['expense', 'invest', 'loan_payment', 'move_to_parking'].includes(entry.type) ? '-' : '+'}
                                    {formatCurrency(entry.amount)}
                                </p>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button style={{ padding: '4px 12px', fontSize: '11px', background: 'transparent', color: 'black', border: '1px solid #f0f0f0' }} onClick={() => openEditModal(entry)}>Edit</button>
                                    <button style={{ padding: '4px 12px', fontSize: '11px', background: 'transparent', color: '#ff4444', border: '1px solid #fff0f0' }} onClick={() => handleDelete(entry.id)}>Delete</button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Add Transaction</h3>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="toggle-group">
                                <button
                                    type="button"
                                    className={formData.type === 'income' ? 'active' : ''}
                                    onClick={() => setFormData({ ...formData, type: 'income' })}
                                >
                                    Income
                                </button>
                                <button
                                    type="button"
                                    className={formData.type === 'expense' ? 'active' : ''}
                                    onClick={() => setFormData({ ...formData, type: 'expense' })}
                                >
                                    Expense
                                </button>
                                <button
                                    type="button"
                                    className={formData.type === 'move_to_parking' ? 'active' : ''}
                                    onClick={() => setFormData({ ...formData, type: 'move_to_parking' })}
                                >
                                    To Parking
                                </button>
                                <button
                                    type="button"
                                    className={formData.type === 'move_from_parking' ? 'active' : ''}
                                    onClick={() => setFormData({ ...formData, type: 'move_from_parking' })}
                                >
                                    From Parking
                                </button>
                            </div>

                            <div className="form-group">
                                <label>Amount</label>
                                <input
                                    type="number"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    required
                                />
                            </div>

                            {(formData.type === 'income' || formData.type === 'expense') && (
                                <div className="form-group">
                                    <label>Category</label>
                                    <select
                                        value={formData.category_id}
                                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Category</option>
                                        {categories?.filter(c => c.type === (formData.type === 'income' ? 'income' : 'expense')).map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Date</label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                                <button type="submit" style={{ flex: 1 }}>Add</button>
                                <button
                                    type="button"
                                    style={{ flex: 1, background: 'white', color: 'black', border: '1px solid #e5e5e5' }}
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {isEditModalOpen && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Edit Transaction</h3>
                        </div>
                        <form onSubmit={handleEditSubmit}>
                            <p style={{ fontSize: '12px', color: '#a3a3a3', marginBottom: '10px' }}>Type: {formData.type.toUpperCase()}</p>
                            <div className="form-group">
                                <label>Amount</label>
                                <input
                                    type="number"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    required
                                />
                            </div>

                            {(formData.type === 'income' || formData.type === 'expense') && (
                                <div className="form-group">
                                    <label>Category</label>
                                    <select
                                        value={formData.category_id}
                                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Category</option>
                                        {categories?.filter(c => c.type === (formData.type === 'income' ? 'income' : 'expense')).map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Date</label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                                <button type="submit" style={{ flex: 1 }}>Save</button>
                                <button
                                    type="button"
                                    style={{ flex: 1, background: 'white', color: 'black', border: '1px solid #e5e5e5' }}
                                    onClick={() => setIsEditModalOpen(null)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Cash;
