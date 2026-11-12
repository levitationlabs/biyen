import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Alert,
    CircularProgress,
    Switch,
    Paper,
    Stack,
    alpha,
} from "@mui/material";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import VpnKeyRoundedIcon from "@mui/icons-material/VpnKeyRounded";
import FingerprintRoundedIcon from "@mui/icons-material/FingerprintRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import { adminClient } from "@/services/adminClient";
import type { AdminUser } from "@/types/admin";

type PendingConfirmAction = "disable_2fa" | "disable_passkeys" | "toggle_email_mfa" | null;
type ActiveLoadingAction = "2fa" | "passkeys" | "email_mfa" | null;

interface InlineConfirmProps {
    prompt: string;
    actionLabel: string;
    isBusy: boolean;
    tone?: "critical" | "accent";
    onConfirm: () => void;
    onCancel: () => void;
}

const InlineConfirm: React.FC<InlineConfirmProps> = ({
    prompt,
    actionLabel,
    isBusy,
    tone = "critical",
    onConfirm,
    onCancel,
}) => {
    const themeColor = tone === "critical" ? "#EA3F3F" : "#C8502E";
    return (
        <Box sx={{ mt: 1.5, p: 1.5, bgcolor: alpha(themeColor, 0.08), borderRadius: 1.5 }}>
            <Typography variant="small" sx={{ display: "block", mb: 1, color: "text.base" }}>
                {prompt}
            </Typography>
            <Stack direction="row" spacing={1}>
                <Button size="small" variant="contained" color={tone} disabled={isBusy} onClick={onConfirm}>
                    {isBusy ? <CircularProgress size={16} /> : actionLabel}
                </Button>
                <Button size="small" color="inherit" disabled={isBusy} onClick={onCancel}>
                    Batal
                </Button>
            </Stack>
        </Box>
    );
};

export interface SecurityModalProps {
    open: boolean;
    user: AdminUser | null;
    onClose: () => void;
    onSuccess?: () => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({
    open,
    user,
    onClose,
    onSuccess,
}) => {
    const [twoFactorActive, setTwoFactorActive] = useState<boolean>(false);
    const [emailMFAActive, setEmailMFAActive] = useState<boolean>(false);
    const [pendingAction, setPendingAction] = useState<PendingConfirmAction>(null);
    const [loadingAction, setLoadingAction] = useState<ActiveLoadingAction>(null);
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        if (!open) return;
        setPendingAction(null);
        setLoadingAction(null);
        setFeedback(null);
        setTwoFactorActive(Boolean(user?.isTwoFactorEnabled));
        setEmailMFAActive(Boolean(user?.isEmailMFAEnabled));
    }, [open, user]);

    const handleAction = async (action: ActiveLoadingAction, run: () => Promise<void>, successText: string) => {
        if (!user || !action) return;
        setLoadingAction(action);
        setFeedback(null);
        try {
            await run();
            setPendingAction(null);
            setFeedback({ type: "success", text: successText });
            onSuccess?.();
        } catch (err) {
            setFeedback({ type: "error", text: err instanceof Error ? err.message : "Operasi gagal" });
        } finally {
            setLoadingAction(null);
        }
    };

    const handleExecuteDisable2FA = () =>
        handleAction("2fa", async () => {
            if (!user) return;
            await adminClient.disableTwoFactor(user.id);
            setTwoFactorActive(false);
        }, "2FA TOTP berhasil dinonaktifkan.");

    const handleExecuteDisablePasskeys = () =>
        handleAction("passkeys", async () => {
            if (!user) return;
            await adminClient.disablePasskeys(user.id);
        }, "Seluruh kunci Passkey berhasil dihapus.");

    const handleExecuteToggleEmailMFA = () => {
        const targetState = !emailMFAActive;
        return handleAction("email_mfa", async () => {
            if (!user) return;
            await adminClient.updateEmailMFA(user.id, targetState);
            setEmailMFAActive(targetState);
        }, targetState ? "Email MFA berhasil diaktifkan." : "Email MFA berhasil dinonaktifkan.");
    };

    return (
        <Dialog open={open} onClose={loadingAction ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 38,
                            height: 38,
                            borderRadius: "50%",
                            bgcolor: "rgba(2, 136, 209, 0.12)",
                            color: "#0288D1",
                        }}
                    >
                        <SecurityRoundedIcon />
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                            Manajemen Keamanan Akun
                        </Typography>
                        <Typography variant="small" sx={{ color: "text.muted" }}>
                            {user?.email}
                        </Typography>
                    </Box>
                </Box>
            </DialogTitle>

            <DialogContent dividers sx={{ py: 2.5 }}>
                {feedback && (
                    <Alert severity={feedback.type} sx={{ mb: 2 }}>
                        {feedback.text}
                    </Alert>
                )}

                <Stack spacing={2}>
                    {/* 2FA TOTP Card */}
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                <VpnKeyRoundedIcon sx={{ color: twoFactorActive ? "#2E7D32" : "text.muted" }} />
                                <Box>
                                    <Typography variant="body" sx={{ fontWeight: 600 }}>
                                        Autentikasi 2FA (TOTP)
                                    </Typography>
                                    <Typography variant="small" sx={{ color: "text.muted", display: "block" }}>
                                        Status: {twoFactorActive ? "Aktif terpasang" : "Tidak aktif"}
                                    </Typography>
                                </Box>
                            </Box>
                            {twoFactorActive && pendingAction !== "disable_2fa" && (
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="critical"
                                    disabled={Boolean(loadingAction)}
                                    onClick={() => setPendingAction("disable_2fa")}
                                >
                                    Nonaktifkan 2FA
                                </Button>
                            )}
                        </Box>
                        {pendingAction === "disable_2fa" && (
                            <InlineConfirm
                                prompt="Apakah Anda yakin ingin menonaktifkan 2FA pengguna ini?"
                                actionLabel="Ya, Nonaktifkan"
                                isBusy={loadingAction === "2fa"}
                                onConfirm={handleExecuteDisable2FA}
                                onCancel={() => setPendingAction(null)}
                            />
                        )}
                    </Paper>

                    {/* Passkeys Card */}
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                <FingerprintRoundedIcon sx={{ color: "#0288D1" }} />
                                <Box>
                                    <Typography variant="body" sx={{ fontWeight: 600 }}>
                                        Kunci Masuk (Passkeys)
                                    </Typography>
                                    <Typography variant="small" sx={{ color: "text.muted", display: "block" }}>
                                        Reset kredensial biometrik & security keys pengguna
                                    </Typography>
                                </Box>
                            </Box>
                            {pendingAction !== "disable_passkeys" && (
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="critical"
                                    disabled={Boolean(loadingAction)}
                                    onClick={() => setPendingAction("disable_passkeys")}
                                >
                                    Hapus Kunci
                                </Button>
                            )}
                        </Box>
                        {pendingAction === "disable_passkeys" && (
                            <InlineConfirm
                                prompt="Hapus seluruh kunci passkey WebAuthn milik akun ini?"
                                actionLabel="Ya, Hapus Semua"
                                isBusy={loadingAction === "passkeys"}
                                onConfirm={handleExecuteDisablePasskeys}
                                onCancel={() => setPendingAction(null)}
                            />
                        )}
                    </Paper>

                    {/* Email MFA Switch Card */}
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                <MarkEmailReadRoundedIcon sx={{ color: emailMFAActive ? "#2E7D32" : "text.muted" }} />
                                <Box>
                                    <Typography variant="body" sx={{ fontWeight: 600 }}>
                                        Verifikasi Email (Email MFA)
                                    </Typography>
                                    <Typography variant="small" sx={{ color: "text.muted", display: "block" }}>
                                        Mengirimkan kode OTP verifikasi ke email saat login
                                    </Typography>
                                </Box>
                            </Box>
                            {pendingAction !== "toggle_email_mfa" && (
                                <Switch
                                    color="accent"
                                    checked={emailMFAActive}
                                    disabled={Boolean(loadingAction)}
                                    onChange={() => setPendingAction("toggle_email_mfa")}
                                />
                            )}
                        </Box>
                        {pendingAction === "toggle_email_mfa" && (
                            <InlineConfirm
                                prompt={
                                    emailMFAActive
                                        ? "Nonaktifkan proteksi OTP login via email untuk akun ini?"
                                        : "Aktifkan proteksi OTP login via email untuk akun ini?"
                                }
                                actionLabel="Konfirmasi Ubah"
                                tone="accent"
                                isBusy={loadingAction === "email_mfa"}
                                onConfirm={handleExecuteToggleEmailMFA}
                                onCancel={() => setPendingAction(null)}
                            />
                        )}
                    </Paper>
                </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={Boolean(loadingAction)} color="inherit">
                    Tutup
                </Button>
            </DialogActions>
        </Dialog>
    );
};
