import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginApi, getMeApi, registerAccountApi } from '../services/api';

export interface UserRole {
  role: string;
  eventId?: string | null;
  eventTitle?: string | null;
}

export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  roles: UserRole[];
}

export interface RolePortalInfo {
  role: string;
  label: string;
  path: string;
}

interface AuthContextType {
  user: UserAccount | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<UserAccount>;
  registerAttendee: (data: { displayName: string; email: string; password: string; phone?: string }) => Promise<UserAccount>;
  logout: () => void;
  hasRole: (roles: string[]) => boolean;
  getPrimaryPortalPath: (targetUser?: UserAccount | null) => string;
  getUserPortals: () => RolePortalInfo[];
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({} as UserAccount),
  registerAttendee: async () => ({} as UserAccount),
  logout: () => {},
  hasRole: () => false,
  getPrimaryPortalPath: () => '/login',
  getUserPortals: () => [],
});

export function getRolePortalLabel(roleName?: string): string {
  switch (roleName) {
    case 'admin':
      return 'Administration';
    case 'organiser':
      return 'Organiser Workspace';
    case 'supervisor':
      return 'Gate Supervisor';
    case 'scanner_operator':
      return 'Gate Terminal';
    case 'auditor':
      return 'Auditor Desk';
    case 'attendee':
      return 'My Tickets';
    default:
      return 'Portal';
  }
}

export function getRolePortalPath(roleName?: string): string {
  switch (roleName) {
    case 'admin':
      return '/portal/admin';
    case 'organiser':
      return '/portal/organiser';
    case 'supervisor':
      return '/portal/supervisor';
    case 'scanner_operator':
      return '/portal/scanner';
    case 'auditor':
      return '/portal/auditor';
    case 'attendee':
      return '/portal/attendee';
    default:
      return '/';
  }
}

export function cleanDisplayName(name?: string): string {
  if (!name) return '';
  return name.replace(/\s*\([^)]*\)/g, '').trim();
}

const formatUser = (u: any): UserAccount => ({
  ...u,
  displayName: cleanDisplayName(u.displayName)
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('etkt_token');
    if (token) {
      getMeApi()
        .then((res) => {
          if (res.success && res.user) {
            setUser(formatUser(res.user));
          } else {
            localStorage.removeItem('etkt_token');
            setUser(null);
          }
        })
        .catch(() => {
          localStorage.removeItem('etkt_token');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password = 'Password@123'): Promise<UserAccount> => {
    const res = await loginApi(email, password);
    if (res.success && res.token) {
      localStorage.setItem('etkt_token', res.token);
      const cleanU = formatUser(res.user);
      setUser(cleanU);
      return cleanU;
    }
    throw new Error(res.error || 'Login failed');
  };

  const registerAttendee = async (data: { displayName: string; email: string; password: string; phone?: string }): Promise<UserAccount> => {
    const res = await registerAccountApi(data);
    if (res.success && res.token) {
      localStorage.setItem('etkt_token', res.token);
      const cleanU = formatUser(res.user);
      setUser(cleanU);
      return cleanU;
    }
    throw new Error(res.error || 'Registration failed');
  };

  const logout = () => {
    localStorage.removeItem('etkt_token');
    setUser(null);
  };

  const hasRole = (roles: string[]) => {
    if (!user) return false;
    if (user.roles.some((r) => r.role === 'admin')) return true;
    return user.roles.some((r) => roles.includes(r.role));
  };

  const getPrimaryPortalPath = (targetUser?: UserAccount | null): string => {
    const u = targetUser !== undefined ? targetUser : user;
    if (!u || u.roles.length === 0) return '/';
    return getRolePortalPath(u.roles[0].role);
  };

  const getUserPortals = (): RolePortalInfo[] => {
    if (!user) return [];
    return user.roles.map((r) => ({
      role: r.role,
      label: getRolePortalLabel(r.role),
      path: getRolePortalPath(r.role),
    }));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        registerAttendee,
        logout,
        hasRole,
        getPrimaryPortalPath,
        getUserPortals,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
