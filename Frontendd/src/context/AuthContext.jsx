import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { API_BASE_URL } from '../config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const mountedRef = useRef(true);

    const fetchUser = async () => {
        try {
            let response = await fetch(`${API_BASE_URL}/api/auth/me`);
            
            // If unauthorized, attempt silent refresh using refresh token cookie
            if (response.status === 401) {
                const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
                    method: 'POST'
                });
                
                if (refreshResponse.ok) {
                    response = await fetch(`${API_BASE_URL}/api/auth/me`);
                }
            }

            if (response.ok && mountedRef.current) {
                const userData = await response.json();
                setUser(userData.user);
            } else {
                localStorage.removeItem('token');
                if (mountedRef.current) {
                    setUser(null);
                }
            }
        } catch (error) {
            console.error('Failed to fetch user', error);
            localStorage.removeItem('token');
            if (mountedRef.current) {
                setUser(null);
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        let mounted = true;

        const initializeUser = async () => {
            // Hit fetchUser directly - cookies are sent automatically
            await fetchUser();
        };

        initializeUser();

        return () => {
            mounted = false;
            mountedRef.current = false;
        };
    }, []);

    const login = (token, userData) => {
        localStorage.setItem('token', token);
        setUser(userData);
    };

    const logout = async (navigate) => {
        try {
            await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' });
        } catch (err) {
            console.error('Failed to logout on server', err);
        }
        localStorage.removeItem('token');
        setUser(null);
        if (navigate) {
            navigate('/');
        } else {
            window.location.href = '/';
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
