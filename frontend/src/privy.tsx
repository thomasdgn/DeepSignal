import { PrivyProvider, usePrivy, type User } from "@privy-io/react-auth";
import { createContext, type ReactNode, useContext, useMemo } from "react";

export type PrivyState = {
  isConfigured: boolean;
  ready: boolean;
  authenticated: boolean;
  user: User | null;
  status: "disabled" | "initializing" | "ready";
  message: string;
  clientIdConfigured: boolean;
  login: () => void | Promise<void>;
  logout: () => Promise<void>;
};

const fallbackState: PrivyState = {
  isConfigured: false,
  ready: true,
  authenticated: false,
  user: null,
  status: "disabled",
  message: "Privy is disabled. Add VITE_PRIVY_APP_ID in frontend/.env and restart Vite.",
  clientIdConfigured: false,
  login: () => undefined,
  logout: async () => undefined,
};

const PrivyStateContext = createContext<PrivyState>(fallbackState);

function PrivyStateBridge({
  children,
  clientIdConfigured,
}: {
  children: ReactNode;
  clientIdConfigured: boolean;
}) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const value = useMemo<PrivyState>(
    () => ({
      isConfigured: true,
      ready,
      authenticated,
      user,
      status: ready ? "ready" : "initializing",
      message: ready
        ? clientIdConfigured
          ? "Privy is ready."
          : "Privy is ready. Client ID is optional, but adding one is recommended."
        : "Privy is initializing. Give it a second before trying to connect.",
      clientIdConfigured,
      login,
      logout,
    }),
    [authenticated, clientIdConfigured, login, logout, ready, user],
  );

  return <PrivyStateContext.Provider value={value}>{children}</PrivyStateContext.Provider>;
}

export function DeepSignalPrivyProvider({ children }: { children: ReactNode }) {
  const appId = import.meta.env.VITE_PRIVY_APP_ID;
  const clientId = import.meta.env.VITE_PRIVY_CLIENT_ID;

  if (!appId) {
    return (
      <PrivyStateContext.Provider
        value={{
          ...fallbackState,
          message:
            "Privy is disabled because VITE_PRIVY_APP_ID is missing. Create frontend/.env, add your Privy values, then restart Vite.",
        }}
      >
        {children}
      </PrivyStateContext.Provider>
    );
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
      <PrivyStateBridge clientIdConfigured={Boolean(clientId)}>{children}</PrivyStateBridge>
    </PrivyProvider>
  );
}

export function useDeepSignalPrivy() {
  return useContext(PrivyStateContext);
}
