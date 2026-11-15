// Biyen Admin — User Detail Side Drawer
// Copyright 2026 Levitation — AGPL-3.0-or-later

import React, { useState, useEffect, useCallback } from "react";
import {
    Drawer,
    Box,
    CircularProgress,
    Alert,
    Button,
    Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import type { AdminUser, AdminUserDetails, UserSubscription } from "@/types/admin";
import { adminClient } from "@/services/adminClient";
import {
    UserDrawerHeader,
    UserDrawerStorage,
    UserDrawerSecurity,
    UserDrawerEscrow,
    UserDrawerSessions,
    UserDrawerActions,
} from "./drawer";

export const USER_DRAWER_WIDTH = 480;

export interface UserDetailDrawerProps {
    open: boolean;
    user: AdminUser | null;
    onClose: () => void;
    onOpenQuota: (user: AdminUser, sub?: UserSubscription) => void;
    onOpenBonus: (user: AdminUser) => void;
    onOpenSuspend: (user: AdminUser) => void;
    onOpenChangeEmail: (user: AdminUser) => void;
    onOpenSecurity: (user: AdminUser) => void;
    onTriggerDelete: (user: AdminUser) => void;
    onUserUpdated: () => void;
}

export const UserDetailDrawer: React.FC<UserDetailDrawerProps> = ({
    open,
    user,
    onClose,
    onOpenQuota,
    onOpenBonus,
    onOpenSuspend,
    onOpenChangeEmail,
    onOpenSecurity,
    onTriggerDelete,
    onUserUpdated,
}) => {
    const [details, setDetails] = useState<AdminUserDetails | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [terminatingToken, setTerminatingToken] = useState<string | null>(null);
    const [isUnsuspending, setIsUnsuspending] = useState(false);

    const loadUserDetails = useCallback(async () => {
        if (!user) {
            setDetails(null);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const data = await adminClient.getUserDetails({
                email: user.email,
                id: user.id,
            });
            setDetails(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Gagal memuat detail pengguna";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (open && user) {
            loadUserDetails();
        } else {
            setDetails(null);
            setError(null);
        }
    }, [open, user, loadUserDetails]);

    const handleTerminateSession = async (tokenString: string) => {
        if (!user) return;
        setTerminatingToken(tokenString);
        try {
            await adminClient.terminateSession({ userID: user.id, token: tokenString });
            await loadUserDetails();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Gagal mencabut sesi login";
            setError(message);
        } finally {
            setTerminatingToken(null);
        }
    };

    const handleUnsuspend = async () => {
        if (!user) return;
        setIsUnsuspending(true);
        try {
            await adminClient.unsuspendUser(user.id);
            onUserUpdated();
            await loadUserDetails();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Gagal memulihkan akun pengguna";
            setError(message);
        } finally {
            setIsUnsuspending(false);
        }
    };

    if (!user) {
        return null;
    }

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            sx={{
                width: { xs: "100%", sm: USER_DRAWER_WIDTH },
                flexShrink: 0,
                "& .MuiDrawer-paper": {
                    width: { xs: "100%", sm: USER_DRAWER_WIDTH },
                    boxSizing: "border-box",
                    bgcolor: "background.default",
                },
            }}
        >
            {/* Header */}
            <UserDrawerHeader user={details?.user ?? user} onClose={onClose} />

            {/* Body */}
            <Box sx={{ p: 3, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                {loading && !details && (
                    <Box sx={{ py: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <CircularProgress size={36} />
                        <Typography variant="body" sx={{ color: "text.secondary" }}>
                            Memuat data lengkap pengguna #{user.id}...
                        </Typography>
                    </Box>
                )}

                {error && (
                    <Alert
                        severity="error"
                        action={
                            <Button color="inherit" size="small" onClick={loadUserDetails} startIcon={<RefreshRoundedIcon />}>
                                Ulangi
                            </Button>
                        }
                    >
                        {error}
                    </Alert>
                )}

                {details && (
                    <>
                        {/* Storage Overview */}
                        <UserDrawerStorage details={details} />

                        {/* Keamanan Akun */}
                        <UserDrawerSecurity
                            user={details.user ?? user}
                            authCodes={details.authCodes}
                            onOpenSecurityModal={() => onOpenSecurity(details.user ?? user)}
                        />

                        {/* Status Brankas Escrow (Post-Quantum Blind Vault) */}
                        <UserDrawerEscrow userId={(details.user ?? user).id} />

                        {/* Sesi Login Aktif */}
                        <UserDrawerSessions
                            tokens={details.tokens}
                            terminatingToken={terminatingToken}
                            onTerminateSession={handleTerminateSession}
                        />

                        {/* Aksi Cepat Admin */}
                        <UserDrawerActions
                            isSuspended={Boolean((details.user ?? user).isSuspended)}
                            isUnsuspending={isUnsuspending}
                            onOpenQuota={() => onOpenQuota(details.user ?? user, details.subscription)}
                            onOpenBonus={() => onOpenBonus(details.user ?? user)}
                            onOpenSuspend={() => onOpenSuspend(details.user ?? user)}
                            onUnsuspend={handleUnsuspend}
                            onOpenChangeEmail={() => onOpenChangeEmail(details.user ?? user)}
                            onTriggerDelete={() => onTriggerDelete(details.user ?? user)}
                        />
                    </>
                )}
            </Box>
        </Drawer>
    );
};
