import { PrivyProvider, usePrivy, type User } from "@privy-io/react-auth";
import { createContext, type ReactNode, useContext, useMemo } from "react";

export type PrivyState = {
  isConfigured: boolean;
  ready: boolean;
  authenticated: boolean;
  user: User | null;
  login: () => void | Promise<void>;
  logout: () => Promise<void>;
};

const fallbackState: PrivyState = {
  isConfigured: false,
  ready: true,
  authenticated: false,
  user: null,
  login: () => undefined,
  logout: async () => undefined,
};

const PrivyStateContext = createContext<PrivyState>(fallbackState);

function PrivyStateBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const value = useMemo<PrivyState>(
    () => ({
      isConfigured: true,
      ready,
      authenticated,
      user,
      login,
      logout,
    }),
    [authenticated, login, logout, ready, user],
  );

  return <PrivyStateContext.Provider value={value}>{children}</PrivyStateContext.Provider>;
}

export function DeepSignalPrivyProvider({ children }: { children: ReactNode }) {
  const appId = import.meta.env.VITE_PRIVY_APP_ID;
  const clientId = import.meta.env.VITE_PRIVY_CLIENT_ID;

  if (!appId) {
    return <PrivyStateContext.Provider value={fallbackState}>{children}</PrivyStateContext.Provider>;
  }

  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId || undefined}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#5d82ff",
          landingHeader: "DeepSignal",
          walletChainType: "ethereum-only",
        },
        loginMethods: ["wallet", "email"],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <PrivyStateBridge>{children}</PrivyStateBridge>
    </PrivyProvider>
  );
}

export function useDeepSignalPrivy() {
  return useContext(PrivyStateContext);
}
