// Biyen Admin — Sudo Re-Authentication Modal
// Copyright 2026 Levitation — AGPL-3.0-or-later

import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Typography,
    Box,
    Alert,
    Tab,
    Tabs,
} from "@mui/material";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import { authStore, SUDO_EXPIRED_EVENT } from "@/services/authStore";
import { OPEN_SUDO_MODAL_EVENT } from "./SudoFreshnessBar";

export interface SudoModalProps {
    open?: boolean;
    onClose?: () => void;
    onSuccess?: () => void;
}

export const SudoModal: React.FC<SudoModalProps> = ({
    open: controlledOpen,
    onClose,
    onSuccess,
}) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const [selectedTab, setSelectedTab] = useState<number>(0);
    const [tokenInput, setTokenInput] = useState("");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const isControlled = controlledOpen !== undefined;
    const isVisible = isControlled ? controlledOpen : internalOpen;

    const handleOpen = () => {
        setTokenInput(authStore.getToken() || "");
        setErrorMessage(null);
        if (!isControlled) {
            setInternalOpen(true);
        }
    };

    const handleClose = () => {
        setErrorMessage(null);
        if (!isControlled) {
            setInternalOpen(false);
        }
        if (onClose) {
            onClose();
        }
    };

    useEffect(() => {
        const handleExpired = () => handleOpen();
        const handleManualOpen = () => handleOpen();

        const unsubscribeExpired = authStore.onSudoExpired(handleExpired);
        window.addEventListener(OPEN_SUDO_MODAL_EVENT, handleManualOpen);
        window.addEventListener(SUDO_EXPIRED_EVENT, handleExpired);

        return () => {
            unsubscribeExpired();
            window.removeEventListener(OPEN_SUDO_MODAL_EVENT, handleManualOpen);
            window.removeEventListener(SUDO_EXPIRED_EVENT, handleExpired);
        };
    }, [isControlled]);

    const handleSaveToken = () => {
        const cleaned = tokenInput.trim();
        if (!cleaned) {
            setErrorMessage("Token admin tidak boleh kosong");
            return;
        }

        authStore.setToken(cleaned);
        handleClose();
        if (onSuccess) {
            onSuccess();
        }
    };

    const handleRefreshExistingToken = () => {
        const existingToken = authStore.getToken();
        if (!existingToken) {
            setErrorMessage("Belum ada token tersimpan. Masukkan token admin terlebih dahulu.");
            return;
        }

        authStore.setToken(existingToken);
        handleClose();
        if (onSuccess) {
            onSuccess();
        }
    };

    return (
        <Dialog
            open={isVisible}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            aria-labelledby="sudo-reauth-dialog-title"
        >
            <DialogTitle id="sudo-reauth-dialog-title" sx={{ fontWeight: 700 }}>
                Autentikasi Sudo Admin
            </DialogTitle>

            <DialogContent dividers>
                <Typography variant="body" color="text.secondary" sx={{ mb: 2, display: "block" }}>
                    Tindakan administratif memerlukan token sesi yang masih segar (berlaku 10 menit
                    sejak diterbitkan) untuk mencegah akses tidak sah.
                </Typography>

                {errorMessage && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {errorMessage}
                    </Alert>
                )}

                <Tabs
                    value={selectedTab}
                    onChange={(_, val) => setSelectedTab(val)}
                    variant="fullWidth"
                    sx={{ mb: 2 }}
                >
                    <Tab icon={<VpnKeyIcon fontSize="small" />} iconPosition="start" label="Input Token" />
                    <Tab icon={<AutorenewIcon fontSize="small" />} iconPosition="start" label="Refresh Sesi" />
                </Tabs>

                {selectedTab === 0 && (
                    <Box sx={{ mt: 1 }}>
                        <TextField
                            label="X-Auth-Token"
                            placeholder="Tempel token admin Anda di sini..."
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                            fullWidth
                            multiline
                            rows={3}
                            autoFocus
                            variant="outlined"
                            helperText="Token admin dapat diperoleh saat login via Ente Photos / CLI admin."
                        />
                    </Box>
                )}

                {selectedTab === 1 && (
                    <Box sx={{ py: 1 }}>
                        <Typography variant="body" sx={{ mb: 2, display: "block" }}>
                            Jika Anda baru saja menyelesaikan autentikasi di tab lain atau ingin
                            memperbarui masa berlaku token yang saat ini tersimpan:
                        </Typography>
                        <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<AutorenewIcon />}
                            onClick={handleRefreshExistingToken}
                            fullWidth
                        >
                            Perbarui Timer Sesi Token Saat Ini
                        </Button>
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={handleClose} color="inherit">
                    Batal
                </Button>
                {selectedTab === 0 && (
                    <Button onClick={handleSaveToken} variant="contained" color="primary">
                        Terapkan Token
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};
