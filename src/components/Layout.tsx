import React from 'react';
import {
    LayoutDashboard,
    Wallet,
    TrendingUp,
    MinusCircle
} from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'cash', label: 'Cash', icon: Wallet },
        { id: 'assets', label: 'Assets', icon: TrendingUp },
        { id: 'liabilities', label: 'Liabilities', icon: MinusCircle },
    ];

    return (
        <div className="app-container">
            <aside className="sidebar">
                <h1 style={{ fontSize: '1.2rem', marginBottom: '20px' }}>Wealth Tracker</h1>
                {navItems.map((item) => (
                    <a
                        key={item.id}
                        href={`#${item.id}`}
                        className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                        onClick={(e) => {
                            e.preventDefault();
                            setActiveTab(item.id);
                        }}
                    >
                        <item.icon size={18} />
                        <span>{item.label}</span>
                    </a>
                ))}
            </aside>
            <main className="main-content">
                {children}
            </main>
        </div>
    );
};

export default Layout;
