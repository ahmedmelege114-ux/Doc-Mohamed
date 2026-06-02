import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Role, RolePermissions, UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  permissions: RolePermissions | null;
  loading: boolean;
  hasPermission: (permission: keyof RolePermissions) => boolean;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  permissions: null,
  loading: true,
  hasPermission: () => false
});

const DEFAULT_PERMISSIONS: Record<Role, RolePermissions> = {
  admin: {
    viewDashboard: true,
    managePatients: true,
    manageAppointments: true,
    viewMedicalRecords: true,
    viewFinances: true,
    viewReports: true,
    manageSettings: true
  },
  doctor: {
    viewDashboard: true,
    managePatients: true,
    manageAppointments: true,
    viewMedicalRecords: true,
    viewFinances: true,
    viewReports: true,
    manageSettings: false
  },
  receptionist: {
    viewDashboard: true,
    managePatients: true,
    manageAppointments: true,
    viewMedicalRecords: true,
    viewFinances: true,
    viewReports: false,
    manageSettings: false
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const hasPermission = (permission: keyof RolePermissions): boolean => {
    if (profile?.role === 'admin') return true;
    if (!permissions) return false;
    return permissions[permission] === true;
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (user) {
        let profileFetched = false;
        let permissionsFetched = false;

        const checkReady = () => {
          if (profileFetched && permissionsFetched) {
            setLoading(false);
          }
        };

        unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.data() as UserProfile;
            setProfile(userData);
            
            // Now fetch permissions based on role
            onSnapshot(doc(db, 'config', 'permissions'), (permSnap) => {
              if (permSnap.exists()) {
                const allPerms = permSnap.data();
                setPermissions(allPerms[userData.role] || DEFAULT_PERMISSIONS[userData.role]);
              } else {
                setPermissions(DEFAULT_PERMISSIONS[userData.role]);
              }
              permissionsFetched = true;
              profileFetched = true;
              checkReady();
            }, (err) => {
              console.error("Permissions snapshot error:", err);
              permissionsFetched = true;
              profileFetched = true;
              checkReady();
            });
          } else {
            setProfile(null);
            setLoading(false);
          }
        }, (error) => {
          console.error("Profile snapshot error:", error);
          setProfile(null);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setPermissions(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, permissions, loading, hasPermission }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
