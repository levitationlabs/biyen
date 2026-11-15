// Biyen Admin — User Drawer Post-Quantum Escrow Status Card (Read-Only Blind Vault)
// Copyright 2026 Levitation — AGPL-3.0-or-later

import React, { useCallback, useEffect, useState } from "react";
import {
    Alert,
    Box,
    Chip,
    CircularProgress,
    IconButton,
    Paper,
    Stack,
    Tooltip,
    Typography,
    alpha,
} from "@mui/material";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import EnhancedEncryptionRoundedIcon from "@mui/icons-material/EnhancedEncryptionRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import type { UserEscrowSummary } from "@/types/admin";
import { adminClient } from "@/services/adminClient";

export interface UserDrawerEscrowProps {
    userId: number;
}

const DISPLAY_CIPHER_LABEL = "X-Wing MLKEM768-X25519";

function formatEscrowTimestamp(isoTimestamp: string | null): string {
    if (!isoTimestamp) {
        return "Belum ada deposit terenkripsi";
    }
    const parsed = new Date(isoTimestamp);
    if (Number.isNaN(parsed.getTime())) {
        return isoTimestamp;
    }
    return parsed.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatCipherSuiteLabel(rawSuite: string): string {
    if (!rawSuite) {
        return DISPLAY_CIPHER_LABEL;
    }
    if (rawSuite.toLowerCase().includes("x-wing") || rawSuite.toLowerCase().includes("mlkem768")) {
        return rawSuite;
    }
    if (rawSuite.toLowerCase().includes("xwing")) {
        return `${DISPLAY_CIPHER_LABEL} (${rawSuite})`;
    }
    return `${DISPLAY_CIPHER_LABEL} · ${rawSuite}`;
}

export const UserDrawerEscrow: React.FC<UserDrawerEscrowProps> = ({ userId }) => {
    const [summary, setSummary] = useState<UserEscrowSummary | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    const loadEscrowSummary = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminClient.getUserEscrowDeposits(userId);
            setSummary(data);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        void loadEscrowSummary();
    }, [loadEscrowSummary]);

    const isManagedMode = (summary?.mode ?? "managed") === "managed";
    const modeLabel = isManagedMode ? "Mode Terkelola (Managed)" : "Zero-Knowledge Murni";
    const kekVersion = summary?.kek_version ?? "v1";
    const cipherLabel = formatCipherSuiteLabel(summary?.cipher_suite ?? DISPLAY_CIPHER_LABEL);
    const lastDepositLabel = formatEscrowTimestamp(summary?.last_deposit_at ?? null);
    const depositVersionsCount = summary?.deposits.length ?? 0;
    const pendingRequests = summary?.pending_requests ?? [];

    return (
        <Paper
            elevation={0}
            data-testid="user-drawer-escrow-card"
            sx={{
                p: 2.5,
                borderRadius: 2.5,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
            }}
        >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <ShieldRoundedIcon sx={{ color: "primary.main", fontSize: 20 }} />
                    <Box>
                        <Typography variant="body" sx={{ fontWeight: 700, display: "block" }}>
                            Status Brankas Escrow (Post-Quantum Blind Vault)
                        </Typography>
                        <Typography variant="small" sx={{ color: "text.secondary" }}>
                            Status penitipan kunci pemulihan terenkripsi
                        </Typography>
                    </Box>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Chip
                        label={modeLabel}
                        size="small"
                        color={isManagedMode ? "success" : "default"}
                        variant={isManagedMode ? "filled" : "outlined"}
                        data-testid="escrow-mode-badge"
                    />
                    <Tooltip title="Muat ulang status brankas escrow">
                        <span>
                            <IconButton
                                size="small"
                                onClick={() => void loadEscrowSummary()}
                                disabled={loading}
                                aria-label="Muat ulang status escrow"
                            >
                                {loading ? (
                                    <CircularProgress size={16} />
                                ) : (
                                    <RefreshRoundedIcon sx={{ fontSize: 18 }} />
                                )}
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>
            </Box>

            <Stack spacing={1.5}>
                {/* KEK Version & Post-Quantum Cipher Suite */}
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: (theme) => alpha(theme.palette.text.primary, 0.02),
                        border: "1px solid",
                        borderColor: "divider",
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <EnhancedEncryptionRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                        <Box>
                            <Typography variant="body" sx={{ fontWeight: 600 }}>
                                Kriptografi Amplop ({kekVersion})
                            </Typography>
                            <Typography
                                variant="small"
                                sx={{ color: "text.secondary", display: "block", fontFamily: "monospace" }}
                            >
                                {cipherLabel}
                            </Typography>
                        </Box>
                    </Box>
                    <Chip
                        label={`KEK ${kekVersion}`}
                        size="small"
                        color="primary"
                        variant="outlined"
                    />
                </Box>

                {/* Last Deposit Timestamp */}
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: (theme) => alpha(theme.palette.text.primary, 0.02),
                        border: "1px solid",
                        borderColor: "divider",
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <HistoryRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                        <Box>
                            <Typography variant="body" sx={{ fontWeight: 600 }}>
                                Deposit Terakhir
                            </Typography>
                            <Typography variant="small" sx={{ color: "text.secondary", display: "block" }}>
                                {lastDepositLabel}
                            </Typography>
                        </Box>
                    </Box>
                    <Chip
                        label={`${depositVersionsCount} Versi`}
                        size="small"
                        color={depositVersionsCount > 0 ? "info" : "default"}
                        variant={depositVersionsCount > 0 ? "filled" : "outlined"}
                    />
                </Box>

                {/* Pending Recovery Requests */}
                <Box
                    sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: (theme) => alpha(theme.palette.text.primary, 0.02),
                        border: "1px solid",
                        borderColor: "divider",
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: pendingRequests.length > 0 ? 1 : 0 }}>
                        <SupportAgentRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="body" sx={{ fontWeight: 600 }}>
                                Permintaan Pemulihan Tertunda
                            </Typography>
                            {pendingRequests.length === 0 && (
                                <Typography variant="small" sx={{ color: "text.secondary", display: "block" }}>
                                    Tidak ada permintaan pemulihan aktif (`request_code`)
                                </Typography>
                            )}
                        </Box>
                        <Chip
                            label={`${pendingRequests.length} Permintaan`}
                            size="small"
                            color={pendingRequests.length > 0 ? "warning" : "default"}
                            variant={pendingRequests.length > 0 ? "filled" : "outlined"}
                        />
                    </Box>

                    {pendingRequests.length > 0 && (
                        <Stack spacing={1} sx={{ mt: 1 }}>
                            {pendingRequests.map((reqItem) => (
                                <Box
                                    key={reqItem.request_id}
                                    sx={{
                                        p: 1,
                                        borderRadius: 1.5,
                                        bgcolor: "background.default",
                                        border: "1px dashed",
                                        borderColor: "warning.main",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                >
                                    <Typography
                                        variant="small"
                                        sx={{ fontFamily: "monospace", fontWeight: 700, letterSpacing: 0.5 }}
                                    >
                                        {reqItem.request_code}
                                    </Typography>
                                    <Chip label={reqItem.status} size="small" color="warning" />
                                </Box>
                            ))}
                        </Stack>
                    )}
                </Box>

                {summary?.delete_scheduled_at && (
                    <Alert severity="warning" sx={{ py: 0.5 }}>
                        Penghapusan brankas (Zero-Knowledge) dijadwalkan pada{" "}
                        {formatEscrowTimestamp(summary.delete_scheduled_at)}.
                    </Alert>
                )}

                {/* Offline CLI Blind Vault Notice */}
                <Alert
                    icon={<TerminalRoundedIcon fontSize="small" />}
                    severity="info"
                    sx={{
                        borderRadius: 2,
                        "& .MuiAlert-message": { fontSize: "0.78rem", lineHeight: 1.45 },
                    }}
                >
                    Dekripsi & persetujuan dilakukan melalui CLI offline{" "}
                    <code>escrow-admin approve</code> (Blind Vault).
                </Alert>
            </Stack>
        </Paper>
    );
};
