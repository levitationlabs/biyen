import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Box,
    Alert,
    CircularProgress,
    alpha,
} from "@mui/material";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import { adminClient } from "@/services/adminClient";

const DANGER_TERRACOTTA = "#EA3F3F";
const WARNING_BG_LIGHT = "rgba(255, 183, 77, 0.15)";
const WARNING_BORDER = "rgba(245, 124, 0, 0.4)";

export interface SuspendModalProps {
    open: boolean;
    user: { id: number; email: string } | null;
    onClose: () => void;
    onSuccess?: () => void;
}

export const SuspendModal: React.FC<SuspendModalProps> = ({
    open,
    user,
    onClose,
    onSuccess,
}) => {
    const [reason, setReason] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setReason("");
            setErrorMessage(null);
        }
    }, [open]);

    const handleSuspend = async () => {
        if (!user) {
            return;
        }
        const trimmedReason = reason.trim();
        if (!trimmedReason) {
            setErrorMessage("Alasan penangguhan wajib diisi untuk audit log.");
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);
        try {
            await adminClient.suspendUser({
                userID: user.id,
                reason: trimmedReason,
            });
            onSuccess?.();
            onClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Gagal menangguhkan akun pengguna";
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={isLoading ? undefined : onClose} maxWidth="sm" fullWidth>
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
                            bgcolor: alpha(DANGER_TERRACOTTA, 0.12),
                            color: DANGER_TERRACOTTA,
                        }}
                    >
                        <BlockRoundedIcon />
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                            Tangguhkan Akun Pengguna
                        </Typography>
                        <Typography variant="small" sx={{ color: "text.muted" }}>
                            {user?.email}
                        </Typography>
                    </Box>
                </Box>
            </DialogTitle>

            <DialogContent dividers sx={{ py: 2.5 }}>
                {errorMessage && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {errorMessage}
                    </Alert>
                )}

                {/* Warning notice box per user requirement */}
                <Box
                    sx={{
                        p: 2,
                        mb: 2.5,
                        borderRadius: 2,
                        bgcolor: WARNING_BG_LIGHT,
                        border: "1px solid",
                        borderColor: WARNING_BORDER,
                        display: "flex",
                        gap: 1.5,
                    }}
                >
                    <WarningAmberRoundedIcon sx={{ color: "#E65100", mt: 0.25, flexShrink: 0 }} />
                    <Typography
                        variant="body"
                        sx={{ color: "text.base", lineHeight: 1.5, fontSize: "0.875rem" }}
                    >
                        <strong>Peringatan:</strong> Penangguhan ini memblokir akses login sementara.
                        Notifikasi email akan dikirimkan kepada pengguna. Jika tidak ada tindak
                        lanjut/klarifikasi sebelum masa aktif langganan berakhir, data dan foto akan
                        dihapus permanen oleh sistem.
                    </Typography>
                </Box>

                <TextField
                    label="Alasan Penangguhan (Reason)"
                    placeholder="Tuliskan alasan penangguhan akun pengguna secara rinci..."
                    multiline
                    rows={3}
                    fullWidth
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={isLoading}
                    helperText="Alasan ini akan dicatat ke dalam log audit administratif."
                    autoFocus
                />
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={isLoading} color="inherit">
                    Batal
                </Button>
                <Button
                    onClick={handleSuspend}
                    disabled={isLoading || !reason.trim()}
                    variant="contained"
                    color="critical"
                    sx={{
                        minWidth: 150,
                        fontWeight: 600,
                    }}
                >
                    {isLoading ? <CircularProgress size={20} color="inherit" /> : "Tangguhkan Akun"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
