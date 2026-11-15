// Biyen Photos — Support-Assisted Post-Quantum Escrow Recovery Dialog
// Copyright 2026 Levitation — AGPL-3.0-or-later

import { Box, Stack, styled, Typography } from "@mui/material";
import { savedPartialLocalUser } from "ente-accounts/services/accounts-db";
import { BIYEN_BRAND } from "ente-base/biyen-config";
import React, { useCallback, useEffect, useState } from "react";
import {
    AuthDialog,
    AuthDialogHeader,
    AuthDialogText,
    AuthDialogTitle,
} from "../auth/AuthDialog";
import { Button } from "../auth/Button";
import { authDialogContentLayout } from "../auth/styles";
import {
    biyenEscrowClient,
    type StoredRecoveryRequestState,
} from "./biyenEscrowClient";

export interface BiyenSupportRecoveryDialogProps {
    open: boolean;
    onClose: () => void;
    onRecovered: (recoveredKey: string) => Promise<void> | void;
}

const COPY_FEEDBACK_DURATION_MS = 2500;

export const BiyenSupportRecoveryDialog: React.FC<BiyenSupportRecoveryDialogProps> = ({
    open,
    onClose,
    onRecovered,
}) => {
    const [requestState, setRequestState] = useState<StoredRecoveryRequestState | null>(null);
    const [initializing, setInitializing] = useState<boolean>(false);
    const [polling, setPolling] = useState<boolean>(false);
    const [copied, setCopied] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const initRecoveryRequest = useCallback(async () => {
        setInitializing(true);
        setStatusMessage(null);
        try {
            const localUser = savedPartialLocalUser();
            const state = await biyenEscrowClient.getOrCreateRecoveryRequest({
                claimedEmail: localUser?.email,
            });
            setRequestState(state);
        } finally {
            setInitializing(false);
        }
    }, []);

    useEffect(() => {
        if (open) {
            void initRecoveryRequest();
        }
    }, [open, initRecoveryRequest]);

    const handleCopyCode = async () => {
        if (!requestState?.requestCode) return;
        try {
            await navigator.clipboard.writeText(requestState.requestCode);
            setCopied(true);
            window.setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION_MS);
        } catch {
            setStatusMessage(`Salin manual Kode Permintaan: ${requestState.requestCode}`);
        }
    };

    const handlePollStatus = async () => {
        if (!requestState) return;
        setPolling(true);
        setStatusMessage(null);
        try {
            const result = await biyenEscrowClient.pollRecoveryRequest(requestState);
            if (result.status === "approved" && result.recoveredKey) {
                setStatusMessage("Pemulihan disetujui! Memulihkan kunci akun Anda...");
                await onRecovered(result.recoveredKey);
                onClose();
                return;
            }
            setStatusMessage(
                result.message ??
                    "Status: Menunggu verifikasi identitas & persetujuan Admin melalui CLI offline.",
            );
        } finally {
            setPolling(false);
        }
    };

    const displayCode = initializing
        ? "MEMUAT-KODE..."
        : (requestState?.requestCode ?? "-----");

    return (
        <AuthDialog
            open={open}
            onClose={onClose}
            ariaLabelledby="biyen-support-recovery-title"
        >
            <DialogContent data-testid="biyen-support-recovery-dialog">
                <AuthDialogHeader>
                    <AuthDialogTitle id="biyen-support-recovery-title">
                        Pemulihan Akun via Biyen Support (Blind Vault)
                    </AuthDialogTitle>
                    <AuthDialogText>
                        Jika akun Anda menggunakan <strong>Mode Terkelola (Managed Escrow)</strong>,
                        perangkat ini membuat kunci sementara Post-Quantum X-Wing. Kirimkan{" "}
                        <strong>Kode Permintaan</strong> 20 karakter di bawah beserta bukti
                        identitas ke tim Biyen Support melalui WhatsApp atau email{" "}
                        <strong>{BIYEN_BRAND.supportEmail}</strong>.
                    </AuthDialogText>
                </AuthDialogHeader>

                <Box
                    sx={{
                        p: 2,
                        borderRadius: 1.5,
                        border: "1px dashed",
                        borderColor: "stroke.muted",
                        bgcolor: "background.elevated",
                        textAlign: "center",
                    }}
                >
                    <Typography
                        variant="small"
                        sx={{ color: "text.muted", display: "block", mb: 0.75 }}
                    >
                        Kode Permintaan Perangkat (Berlaku 72 Jam)
                    </Typography>
                    <Typography
                        variant="h3"
                        data-testid="biyen-request-code"
                        sx={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            letterSpacing: 1,
                            wordBreak: "break-all",
                            mb: 1.5,
                        }}
                    >
                        {displayCode}
                    </Typography>
                    <Button
                        variant="secondary"
                        fullWidth
                        disabled={initializing || !requestState}
                        onClick={() => void handleCopyCode()}
                        data-testid="copy-request-code-btn"
                    >
                        {copied ? "Kode Permintaan Tersalin" : "Salin Kode Permintaan"}
                    </Button>
                </Box>

                {statusMessage && (
                    <Typography
                        variant="small"
                        data-testid="recovery-poll-status"
                        sx={{ color: "text.muted", textAlign: "center" }}
                    >
                        {statusMessage}
                    </Typography>
                )}

                <Stack spacing={1.25} sx={{ width: "100%" }}>
                    <Button
                        fullWidth
                        loading={polling}
                        disabled={initializing || !requestState}
                        onClick={() => void handlePollStatus()}
                        data-testid="poll-recovery-status-btn"
                    >
                        Cek Status Pemulihan
                    </Button>
                    <Button
                        variant="secondary"
                        fullWidth
                        onClick={onClose}
                    >
                        Tutup
                    </Button>
                </Stack>
            </DialogContent>
        </AuthDialog>
    );
};

const DialogContent = styled("div")(authDialogContentLayout);
