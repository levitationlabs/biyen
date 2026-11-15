// Biyen Photos — Post-Quantum Protection Mode Selector Banner
// Copyright 2026 Levitation — AGPL-3.0-or-later

import { Box, Button, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import {
    biyenEscrowClient,
    type BiyenEscrowMode,
    type EscrowStatusResponse,
} from "./biyenEscrowClient";

export interface BiyenProtectionModeBannerProps {
    recoveryKey: string | undefined;
}

export const BiyenProtectionModeBanner: React.FC<BiyenProtectionModeBannerProps> = ({
    recoveryKey,
}) => {
    const [status, setStatus] = useState<EscrowStatusResponse | null>(null);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

    const refreshStatus = useCallback(async () => {
        const current = await biyenEscrowClient.getStatus();
        setStatus(current);
    }, []);

    useEffect(() => {
        void refreshStatus();
    }, [refreshStatus]);

    const handleSelectManaged = async () => {
        if (!recoveryKey) return;
        setSubmitting(true);
        setFeedbackMessage(null);
        try {
            if (status?.delete_scheduled_at) {
                await biyenEscrowClient.cancelZeroKnowledge();
            }
            const updated = await biyenEscrowClient.depositRecoveryKey({ recoveryKey });
            setStatus(updated);
            setFeedbackMessage(
                "Mode Terkelola aktif: kunci pemulihan diamankan dengan enkripsi X-Wing Post-Quantum (Blind Vault).",
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleSelectZeroKnowledge = async () => {
        setSubmitting(true);
        setFeedbackMessage(null);
        try {
            const updated = await biyenEscrowClient.scheduleZeroKnowledge();
            setStatus(updated);
            setFeedbackMessage(
                "Mode Zero-Knowledge Murni dipilih (penghapusan deposit escrow dijadwalkan 7 hari).",
            );
        } finally {
            setSubmitting(false);
        }
    };

    const currentMode: BiyenEscrowMode = status?.mode ?? "managed";
    const isManaged = currentMode === "managed";

    return (
        <Box
            data-testid="biyen-protection-mode-banner"
            sx={{
                mt: 2.5,
                p: 2,
                borderRadius: 1.5,
                border: "1px solid",
                borderColor: "stroke.faint",
                bgcolor: "background.elevated",
            }}
        >
            <Stack spacing={1.5}>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 1,
                    }}
                >
                    <Typography variant="body" sx={{ fontWeight: 700 }}>
                        Mode Perlindungan Kunci Pemulihan Biyen
                    </Typography>
                    <Chip
                        size="small"
                        color={isManaged ? "success" : "default"}
                        label={
                            isManaged
                                ? "Mode Terkelola (Managed)"
                                : "Zero-Knowledge Murni"
                        }
                    />
                </Box>

                <Typography variant="small" sx={{ color: "text.muted" }}>
                    Pilih bagaimana Biyen melindungi akses akun Anda jika suatu saat Anda lupa
                    password sekaligus kehilangan 24 kata kunci pemulihan:
                </Typography>

                <Stack spacing={1}>
                    <Box
                        sx={{
                            p: 1.5,
                            borderRadius: 1,
                            border: "1px solid",
                            borderColor: isManaged ? "accent.base" : "stroke.faint",
                        }}
                    >
                        <Typography variant="small" sx={{ fontWeight: 700, display: "block" }}>
                            1. Mode Terkelola (Managed Escrow — Post-Quantum) · Disarankan
                        </Typography>
                        <Typography
                            variant="mini"
                            sx={{ color: "text.muted", display: "block", mt: 0.5, mb: 1 }}
                        >
                            Perangkat mengenkripsi kunci pemulihan dengan HPKE Hybrid X-Wing
                            (MLKEM768-X25519) ke Admin Custody Key (Blind Vault). Dapat dipulihkan
                            melalui verifikasi identitas Biyen Support.
                        </Typography>
                        <Button
                            size="small"
                            variant={isManaged ? "contained" : "outlined"}
                            color="accent"
                            disabled={submitting || !recoveryKey}
                            onClick={() => void handleSelectManaged()}
                            data-testid="select-managed-escrow-btn"
                        >
                            {submitting && isManaged ? (
                                <CircularProgress size={14} sx={{ mr: 1 }} />
                            ) : null}
                            Aktifkan Mode Terkelola (Post-Quantum)
                        </Button>
                    </Box>

                    <Box
                        sx={{
                            p: 1.5,
                            borderRadius: 1,
                            border: "1px solid",
                            borderColor: !isManaged ? "accent.base" : "stroke.faint",
                        }}
                    >
                        <Typography variant="small" sx={{ fontWeight: 700, display: "block" }}>
                            2. Mode Zero-Knowledge Murni
                        </Typography>
                        <Typography
                            variant="mini"
                            sx={{ color: "text.muted", display: "block", mt: 0.5, mb: 1 }}
                        >
                            Tidak ada cadangan di brankas escrow. Jika lupa password dan kehilangan
                            24 kata, akun tidak dapat dipulihkan oleh siapa pun termasuk Admin.
                        </Typography>
                        <Button
                            size="small"
                            variant={!isManaged ? "contained" : "outlined"}
                            color="secondary"
                            disabled={submitting}
                            onClick={() => void handleSelectZeroKnowledge()}
                            data-testid="select-zero-knowledge-btn"
                        >
                            Pilih Mode Zero-Knowledge Murni
                        </Button>
                    </Box>
                </Stack>

                {feedbackMessage && (
                    <Typography variant="mini" sx={{ color: "accent.base", fontWeight: 600 }}>
                        {feedbackMessage}
                    </Typography>
                )}
            </Stack>
        </Box>
    );
};
