import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type SosViewIntentContextValue = {
    pendingViewContactId: string | null;
    setPendingViewContactId: (contactId: string | null) => void;
    consumePendingViewContactId: () => string | null;
};

const SosViewIntentContext = createContext<SosViewIntentContextValue | null>(null);

export function SosViewIntentProvider({ children }: { children: React.ReactNode }) {
    const [pendingViewContactId, setPendingViewContactId] = useState<string | null>(null);

    const consumePendingViewContactId = useCallback(() => {
        if (!pendingViewContactId) return null;
        const v = pendingViewContactId;
        setPendingViewContactId(null);
        return v;
    }, [pendingViewContactId]);

    const value = useMemo(
        () => ({ pendingViewContactId, setPendingViewContactId, consumePendingViewContactId }),
        [pendingViewContactId, consumePendingViewContactId]
    );

    return <SosViewIntentContext.Provider value={value}>{children}</SosViewIntentContext.Provider>;
}

export function useSosViewIntent() {
    const ctx = useContext(SosViewIntentContext);
    if (!ctx) throw new Error("useSosViewIntent must be used within SosViewIntentProvider");
    return ctx;
}
