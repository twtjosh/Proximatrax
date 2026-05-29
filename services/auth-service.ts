import type { User } from "@supabase/supabase-js";
import { getRoleHomePath } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";
import type { UserRole } from "@/types/enums";
export type LoginCredentials = {
    email: string;
    password: string;
};
export type CreateUserPayload = {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
    contactNumber?: string;
};
export type AuthSessionResult = {
    user: User;
    profile: Profile | null;
    redirectTo: string;
};
export async function getProfile(userId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
    if (error) {
        throw error;
    }
    return data as Profile;
}
export async function login({ email, password, }: LoginCredentials): Promise<AuthSessionResult> {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
    });
    if (error) {
        throw error;
    }
    if (!data.user) {
        throw new Error("Unable to sign in. Please try again.");
    }
    const profile = await getProfile(data.user.id);
    return {
        user: data.user,
        profile,
        redirectTo: getRoleHomePath(profile.role),
    };
}
export async function createUser(payload: CreateUserPayload): Promise<void> {
    const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        let message = "Unable to create account.";
        try {
            const data = (await response.json()) as {
                error?: string;
            };
            if (data.error)
                message = data.error;
        }
        catch {
        }
        throw new Error(message);
    }
}
export async function deleteUser(userId: string): Promise<void> {
    const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
    });
    if (!response.ok) {
        let message = "Unable to delete account.";
        try {
            const data = (await response.json()) as {
                error?: string;
            };
            if (data.error)
                message = data.error;
        }
        catch {
        }
        throw new Error(message);
    }
}
export async function logout() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
        throw error;
    }
}
export async function sendPasswordReset(email: string) {
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${origin}/api/auth/callback`,
    });
    if (error) {
        throw error;
    }
}
export async function getCurrentAuthSession(): Promise<AuthSessionResult | null> {
    const supabase = createClient();
    const { data: { user }, error, } = await supabase.auth.getUser();
    if (error || !user) {
        return null;
    }
    const profile = await getProfile(user.id);
    return {
        user,
        profile,
        redirectTo: getRoleHomePath(profile.role),
    };
}
