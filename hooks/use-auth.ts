"use client";
import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getProfile, logout as logoutUser } from "@/services/auth-service";
import type { Profile } from "@/types/database";
type AuthState = {
    user: User | null;
    session: Session | null;
    profile: Profile | null;
    isLoading: boolean;
    error: string | null;
};
export function useAuth() {
    const [state, setState] = useState<AuthState>({
        user: null,
        session: null,
        profile: null,
        isLoading: true,
        error: null,
    });
    const refreshProfile = useCallback(async (userId: string) => {
        try {
            const profile = await getProfile(userId);
            setState((current) => ({ ...current, profile, error: null }));
            return profile;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unable to load profile.";
            setState((current) => ({ ...current, profile: null, error: message }));
            return null;
        }
    }, []);
    useEffect(() => {
        const supabase = createClient();
        async function loadSession() {
            const { data: { session }, } = await supabase.auth.getSession();
            const user = session?.user ?? null;
            setState({
                session,
                user,
                profile: null,
                isLoading: false,
                error: null,
            });
            if (user) {
                await refreshProfile(user.id);
            }
        }
        loadSession();
        const { data: { subscription }, } = supabase.auth.onAuthStateChange((_event, session) => {
            const user = session?.user ?? null;
            setState({
                session,
                user,
                profile: null,
                isLoading: false,
                error: null,
            });
            if (user) {
                refreshProfile(user.id);
            }
        });
        return () => {
            subscription.unsubscribe();
        };
    }, [refreshProfile]);
    const logout = useCallback(async () => {
        await logoutUser();
        setState({
            user: null,
            session: null,
            profile: null,
            isLoading: false,
            error: null,
        });
    }, []);
    return {
        ...state,
        role: state.profile?.role ?? null,
        isAuthenticated: Boolean(state.user),
        refreshProfile,
        logout,
    };
}
