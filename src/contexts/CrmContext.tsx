import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { ensureUserWorkspace, mapCustomerDoc } from '../lib/crm-service';
import type { CustomerRecord, UserProfileRecord, WorkspaceRecord } from '../types/crm';

interface CrmContextValue {
  user: User | null;
  profile: UserProfileRecord | null;
  workspace: WorkspaceRecord | null;
  customers: CustomerRecord[];
  loadingAuth: boolean;
  loadingData: boolean;
  signingIn: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateLocalWorkspaceName: (name: string, mode: 'personal' | 'team') => void;
}

const CrmContext = createContext<CrmContextValue | null>(null);

export function CrmProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  if (fatalError) {
    throw fatalError;
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setWorkspace(null);
        setCustomers([]);
        setLoadingAuth(false);
        setLoadingData(false);
        return;
      }

      setLoadingData(true);
      try {
        const result = await ensureUserWorkspace(firebaseUser);
        setProfile(result.profile);
        setWorkspace(result.workspace);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setFatalError(err);
      } finally {
        setLoadingAuth(false);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !workspace) {
      return;
    }

    setLoadingData(true);
    const customersPath = `workspaces/${workspace.id}/customers`;
    const q = query(
      collection(db, 'workspaces', workspace.id, 'customers'),
      where('ownerId', '==', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => mapCustomerDoc(d.id, d.data()));
        list.sort((a, b) => {
          const ta = a.updatedAt ? a.updatedAt.getTime() : 0;
          const tb = b.updatedAt ? b.updatedAt.getTime() : 0;
          return tb - ta;
        });
        setCustomers(list);
        setLoadingData(false);
      },
      (error) => {
        setLoadingData(false);
        try {
          handleFirestoreError(error, OperationType.LIST, customersPath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    return () => unsub();
  }, [user, workspace]);

  const signInWithGoogle = useCallback(async () => {
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('Đăng nhập thành công');
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        toast.info('Bạn đã đóng cửa sổ đăng nhập');
      } else if (code === 'auth/popup-blocked') {
        toast.error('Trình duyệt đang chặn popup. Vui lòng cho phép popup để đăng nhập Google.');
      } else if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'domain hiện tại';
        toast.error(
          `Tên miền "${host}" chưa được cấp phép trong Firebase Authentication (Authorized domains).`
        );
      } else if (code === 'auth/operation-not-allowed') {
        toast.error('Đăng nhập Google chưa được bật trong Firebase Authentication.');
      } else {
        toast.error('Không thể đăng nhập Google. Vui lòng thử lại.');
        console.error('Google Sign-In error:', error);
      }
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      toast.success('Đã đăng xuất');
    } catch (error) {
      toast.error('Không thể đăng xuất. Vui lòng thử lại.');
      console.error('Sign out error:', error);
    }
  }, []);

  const updateLocalWorkspaceName = useCallback((name: string, mode: 'personal' | 'team') => {
    setWorkspace((prev) => (prev ? { ...prev, name, mode } : prev));
  }, []);

  return (
    <CrmContext.Provider
      value={{
        user,
        profile,
        workspace,
        customers,
        loadingAuth,
        loadingData,
        signingIn,
        signInWithGoogle,
        signOut,
        updateLocalWorkspaceName,
      }}
    >
      {children}
    </CrmContext.Provider>
  );
}

export function useCrm(): CrmContextValue {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error('useCrm must be used inside CrmProvider');
  return ctx;
}
