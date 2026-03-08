import React from 'react';
import {
    LayoutDashboard,
    Wallet,
    TrendingUp,
    MinusCircle,
    LogIn,
    LogOut,
    RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { syncEverything, clearAllData } from '../logic';

interface LayoutProps {
    children: React.ReactNode;
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
    const { user, loginWithGoogle, logout } = useAuth();
    const [isSyncing, setIsSyncing] = React.useState(false);

    const handleSync = async () => {
        if (!user || isSyncing) return;
        setIsSyncing(true);
        try {
            await syncEverything(user.uid);
            // Optionally reload page or state if needed, but Dexie hooks usually handle it
        } catch (error) {
            console.error('Sync failed:', error);
            alert('Sync failed. Please try again.');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleReset = async () => {
        if (!window.confirm('Are you absolutely sure? This will wipe ALL your data locally and in the cloud. This cannot be undone.')) return;

        setIsSyncing(true);
        try {
            await clearAllData();
            alert('Account reset successfully.');
            window.location.reload();
        } catch (error) {
            console.error('Reset failed:', error);
            alert('Reset failed. Please try again.');
        } finally {
            setIsSyncing(false);
        }
    };

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
                {user && (
                    <button
                        className="nav-item reset-button"
                        onClick={handleReset}
                        style={{ marginTop: 'auto', color: '#ff4d4f' }}
                    >
                        <LogOut size={18} />
                        <span>Reset Account</span>
                    </button>
                )}
            </aside>
            <main className="main-content">
                <header className="auth-header" style={{ alignItems: 'center', gap: '16px' }}>
                    {user && (
                        <button
                            className="sync-button"
                            onClick={handleSync}
                            disabled={isSyncing}
                            title="Sync Data"
                        >
                            <RefreshCw size={16} className={isSyncing ? 'spin' : ''} />
                            <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
                        </button>
                    )}
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
