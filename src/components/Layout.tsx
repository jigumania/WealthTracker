import React from 'react';
import {
    LayoutDashboard,
    Wallet,
    TrendingUp,
    MinusCircle,
    LogIn,
    LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
    children: React.ReactNode;
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
    const { user, loginWithGoogle, logout } = useAuth();
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'cash', label: 'Cash', icon: Wallet },
        { id: 'assets', label: 'Assets', icon: TrendingUp },
        { id: 'liabilities', label: 'Liabilities', icon: MinusCircle },
    ];

    return (
        <div className="app-container">
            <aside className="sidebar">
                <h1>Wealth Tracker</h1>
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
                <header className="auth-header">
                    {!user ? (
                        <button className="auth-button" onClick={loginWithGoogle}>
                            <LogIn size={18} />
                            <span>Login with Google</span>
                        </button>
                    ) : (
                        <div className="user-profile">
                            <img src={user.photoURL || ''} alt={user.displayName || ''} className="user-avatar" />
                            <div className="user-info">
                                <span className="user-name">{user.displayName}</span>
                                <button className="logout-button" onClick={logout} title="Logout">
                                    <LogOut size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </header>
                {children}
            </main>
        </div>
    );
};

export default Layout;
