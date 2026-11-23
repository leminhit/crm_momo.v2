import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  backfillOrdersFromWonCustomers,
  ensureUserWorkspace,
  getSkippedBackfillCustomerIds,
  mapCustomerDoc,
  mapOrderDoc,
} from '../lib/crm-service';
import { compareCustomersByCreatedDate } from '../lib/payroll';
import type {
  CustomerRecord,
  OrderRecord,
  UserProfileRecord,
  WorkspaceRecord,
} from '../types/crm';

interface CachedSessionHint {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  workspaceId: string;
  workspaceName: string;
  workspaceMode: 'personal' | 'team';
}

const SESSION_HINT_KEY = 'crm_session_hint_v1';

function readSessionHint(): CachedSessionHint | null {
  try {
    const raw = localStorage.getItem(SESSION_HINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedSessionHint>;
    if (!parsed.uid || !parsed.workspaceId) return null;
    return {
      uid: String(parsed.uid),
      displayName: String(parsed.displayName || 'Người dùng CRM'),
      email: String(parsed.email || ''),
      photoURL: typeof parsed.photoURL === 'string' ? parsed.photoURL : undefined,
      workspaceId: String(parsed.workspaceId),
      workspaceName: String(parsed.workspaceName || 'CRM Cá Nhân'),
      workspaceMode: parsed.workspaceMode === 'team' ? 'team' : 'personal',
    };
  } catch {
    return null;
  }
}

function writeSessionHint(hint: CachedSessionHint | null): void {
  try {
    if (!hint) {
      localStorage.removeItem(SESSION_HINT_KEY);
    } else {
      localStorage.setItem(SESSION_HINT_KEY, JSON.stringify(hint));
    }
  } catch {
    // Ignore storage quota / private mode errors
  }
}

function buildProfileFromHint(hint: CachedSessionHint): UserProfileRecord {
  return {
    uid: hint.uid,
    displayName: hint.displayName,
    email: hint.email,
    photoURL: hint.photoURL,
    defaultWorkspaceId: hint.workspaceId,
    createdAt: null,
    updatedAt: null,
  };
}

function buildWorkspaceFromHint(hint: CachedSessionHint): WorkspaceRecord {
  return {
    id: hint.workspaceId,
    name: hint.workspaceName,
    ownerId: hint.uid,
    mode: hint.workspaceMode,
    createdAt: null,
    updatedAt: null,
  };
}

interface CrmContextValue {
  user: User | null;
  isAuthenticated: boolean;
  profile: UserProfileRecord | null;
  workspace: WorkspaceRecord | null;
  customers: CustomerRecord[];
  orders: OrderRecord[];
  loadingAuth: boolean;
  loadingData: boolean;
  signingIn: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateLocalWorkspaceName: (name: string, mode: 'personal' | 'team') => void;
  ensureWorkspaceReady: () => Promise<{ uid: string; workspaceId: string }>;
}

const CrmContext = createContext<CrmContextValue | null>(null);

export function CrmProvider({ children }: { children: React.ReactNode }) {
  const initialHintRef = useRef<CachedSessionHint | null>(readSessionHint());

  const [user, setUser] = useState<User | null>(null);
  const [hasCachedSession, setHasCachedSession] = useState<boolean>(
    Boolean(initialHintRef.current)
  );
  const [profile, setProfile] = useState<UserProfileRecord | null>(() =>
    initialHintRef.current ? buildProfileFromHint(initialHintRef.current) : null
  );
  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(() =>
    initialHintRef.current ? buildWorkspaceFromHint(initialHintRef.current) : null
  );
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(!initialHintRef.current);
  const [loadingData, setLoadingData] = useState<boolean>(Boolean(initialHintRef.current));
  const [signingIn, setSigningIn] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const workspaceReadyPromiseRef = useRef<Promise<{ uid: string; workspaceId: string }> | null>(
    null
  );
  const backfillRanSessionRef = useRef<string | null>(null);
  const authReadyResolverRef = useRef<{
    resolve: (u: User | null) => void;
  } | null>(null);
  const authReadyPromiseRef = useRef<Promise<User | null>>(
    new Promise((resolve) => {
      authReadyResolverRef.current = { resolve };
    })
  );

  if (fatalError) {
    throw fatalError;
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (authReadyResolverRef.current) {
        authReadyResolverRef.current.resolve(firebaseUser);
        authReadyResolverRef.current = null;
      }

      if (!firebaseUser) {
        writeSessionHint(null);
        setHasCachedSession(false);
        setProfile(null);
        setWorkspace(null);
        setCustomers([]);
        setOrders([]);
        workspaceReadyPromiseRef.current = null;
        backfillRanSessionRef.current = null;
        setLoadingAuth(false);
        setLoadingData(false);
        return;
      }

      // Immediately unlock UI & optimistic workspace so AppShell + listener start with zero waterfall
      const cached = readSessionHint();
      const matchingCache = cached && cached.uid === firebaseUser.uid ? cached : null;
      const optimisticWsId = matchingCache?.workspaceId || `personal_${firebaseUser.uid}`;

      setHasCachedSession(true);
      setLoadingAuth(false);
      setLoadingData(true);

      setProfile((prev) =>
        prev && prev.uid === firebaseUser.uid
          ? prev
          : {
              uid: firebaseUser.uid,
              displayName:
                matchingCache?.displayName ||
                firebaseUser.displayName ||
                firebaseUser.email?.split('@')[0] ||
                'Người dùng CRM',
              email: matchingCache?.email || firebaseUser.email || '',
              photoURL: matchingCache?.photoURL || firebaseUser.photoURL || undefined,
              defaultWorkspaceId: optimisticWsId,
              createdAt: null,
              updatedAt: null,
            }
      );

      setWorkspace((prev) =>
        prev && prev.ownerId === firebaseUser.uid
          ? prev
          : {
              id: optimisticWsId,
              name: matchingCache?.workspaceName || 'CRM Cá Nhân',
              ownerId: firebaseUser.uid,
              mode: matchingCache?.workspaceMode || 'personal',
              createdAt: null,
              updatedAt: null,
            }
      );

      // Sync actual workspace & profile in background without blocking initial render
      const syncPromise = ensureUserWorkspace(firebaseUser)
        .then((result) => {
          setProfile(result.profile);
          setWorkspace((prev) =>
            prev &&
            prev.id === result.workspace.id &&
            prev.name === result.workspace.name &&
            prev.mode === result.workspace.mode &&
            prev.createdAt !== null
              ? prev
              : result.workspace
          );
          writeSessionHint({
            uid: firebaseUser.uid,
            displayName: result.profile.displayName,
            email: result.profile.email,
            photoURL: result.profile.photoURL,
            workspaceId: result.workspace.id,
            workspaceName: result.workspace.name,
            workspaceMode: result.workspace.mode,
          });
          return {
            uid: firebaseUser.uid,
            workspaceId: result.workspace.id,
          };
        })
        .catch((error) => {
          const err = error instanceof Error ? error : new Error(String(error));
          setFatalError(err);
          throw err;
        });

      workspaceReadyPromiseRef.current = syncPromise;
    });

    return () => unsub();
  }, []);

  const activeUserId = user?.uid ?? null;
  const activeWorkspaceId = workspace?.id ?? null;

  useEffect(() => {
    if (!activeUserId || !activeWorkspaceId) {
      return;
    }

    setLoadingData(true);
    let cancelled = false;
    let customersReady = false;
    let ordersReady = false;
    let customersFromServer = false;
    let ordersFromServer = false;
    let latestCustomers: CustomerRecord[] = [];
    let latestOrders: OrderRecord[] = [];

    const markReadyIfBoth = () => {
      if (customersReady && ordersReady) {
        setLoadingData(false);
      }
      const sessionKey = `${activeUserId}:${activeWorkspaceId}`;
      if (
        customersFromServer &&
        ordersFromServer &&
        backfillRanSessionRef.current !== sessionKey
      ) {
        backfillRanSessionRef.current = sessionKey;
        void (async () => {
          try {
            if (workspaceReadyPromiseRef.current) {
              const ready = await workspaceReadyPromiseRef.current;
              if (cancelled || ready.workspaceId !== activeWorkspaceId) return;
            }
            const skipIds = getSkippedBackfillCustomerIds(activeWorkspaceId);
            const result = await backfillOrdersFromWonCustomers(
              activeWorkspaceId,
              activeUserId,
              latestCustomers,
              latestOrders,
              { skipCustomerIds: skipIds }
            );
            if (!cancelled && result.created > 0) {
              toast.success(
                `Đã tự động tạo ${result.created} đơn hàng từ khách Đã bán và phân theo ${result.monthCount} tháng`
              );
            }
          } catch (error) {
            console.error('Auto backfill orders error:', error);
          }
        })();
      }
    };

    const customersPath = `workspaces/${activeWorkspaceId}/customers`;
    const customersQuery = query(
      collection(db, 'workspaces', activeWorkspaceId, 'customers'),
      where('ownerId', '==', activeUserId)
    );

    const unsubCustomers = onSnapshot(
      customersQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        const shouldUpdateList =
          !customersReady || snapshot.docChanges().length > 0;
        if (shouldUpdateList) {
          const list = snapshot.docs.map((d) => mapCustomerDoc(d.id, d.data()));
          list.sort((a, b) => compareCustomersByCreatedDate(a, b, 'desc'));
          latestCustomers = list;
          setCustomers(list);
        }
        customersReady = true;
        if (!snapshot.metadata.fromCache) {
          customersFromServer = true;
        }
        markReadyIfBoth();
      },
      (error) => {
        customersReady = true;
        markReadyIfBoth();
        try {
          handleFirestoreError(error, OperationType.LIST, customersPath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    const ordersPath = `workspaces/${activeWorkspaceId}/orders`;
    const ordersQuery = query(
      collection(db, 'workspaces', activeWorkspaceId, 'orders'),
      where('ownerId', '==', activeUserId)
    );

    const unsubOrders = onSnapshot(
      ordersQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        const shouldUpdateList =
          !ordersReady || snapshot.docChanges().length > 0;
        if (shouldUpdateList) {
          const list = snapshot.docs.map((d) => mapOrderDoc(d.id, d.data()));
          list.sort((a, b) => {
            if (a.soldAt !== b.soldAt) return b.soldAt.localeCompare(a.soldAt);
            const ta = a.createdAt ? a.createdAt.getTime() : 0;
            const tb = b.createdAt ? b.createdAt.getTime() : 0;
            return tb - ta;
          });
          latestOrders = list;
          setOrders(list);
        }
        ordersReady = true;
        if (!snapshot.metadata.fromCache) {
          ordersFromServer = true;
        }
        markReadyIfBoth();
      },
      (error) => {
        ordersReady = true;
        markReadyIfBoth();
        try {
          handleFirestoreError(error, OperationType.LIST, ordersPath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    return () => {
      cancelled = true;
      unsubCustomers();
      unsubOrders();
    };
  }, [activeUserId, activeWorkspaceId]);

  const ensureWorkspaceReady = useCallback(async () => {
    if (workspaceReadyPromiseRef.current) {
      return workspaceReadyPromiseRef.current;
    }
    const resolvedUser = user ?? (await authReadyPromiseRef.current);
    if (!resolvedUser) {
      throw new Error('Phiên đăng nhập chưa sẵn sàng.');
    }
    if (workspaceReadyPromiseRef.current) {
      return workspaceReadyPromiseRef.current;
    }
    const result = await ensureUserWorkspace(resolvedUser);
    return {
      uid: resolvedUser.uid,
      workspaceId: result.workspace.id,
    };
  }, [user]);

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
      writeSessionHint(null);
      setHasCachedSession(false);
      await firebaseSignOut(auth);
      toast.success('Đã đăng xuất');
    } catch (error) {
      toast.error('Không thể đăng xuất. Vui lòng thử lại.');
      console.error('Sign out error:', error);
    }
  }, []);

  const updateLocalWorkspaceName = useCallback((name: string, mode: 'personal' | 'team') => {
    setWorkspace((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, name, mode };
      const cached = readSessionHint();
      if (cached && cached.uid === prev.ownerId) {
        writeSessionHint({
          ...cached,
          workspaceName: name,
          workspaceMode: mode,
        });
      }
      return updated;
    });
  }, []);

  return (
    <CrmContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user) || hasCachedSession,
        profile,
        workspace,
        customers,
        orders,
        loadingAuth,
        loadingData,
        signingIn,
        signInWithGoogle,
        signOut,
        updateLocalWorkspaceName,
        ensureWorkspaceReady,
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
