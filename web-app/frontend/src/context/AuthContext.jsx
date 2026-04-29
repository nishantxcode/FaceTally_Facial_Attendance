import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('facetally_token');
        const savedUser = localStorage.getItem('facetally_user');
        if (token && savedUser) {
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        const response = await authAPI.login(username, password);
        const { token, username: name } = response.data;
        localStorage.setItem('facetally_token', token);
        localStorage.setItem('facetally_user', JSON.stringify({ username: name }));
        setUser({ username: name });
        return response.data;
    };

    const logout = () => {
        localStorage.removeItem('facetally_token');
        localStorage.removeItem('facetally_user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
