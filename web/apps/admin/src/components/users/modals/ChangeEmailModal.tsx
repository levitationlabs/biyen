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
} from "@mui/material";
import AlternateEmailRoundedIcon from "@mui/icons-material/AlternateEmailRounded";
import { adminClient } from "@/services/adminClient";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ChangeEmailModalProps {
    open: boolean;
    user: { id: number; email: string } | null;
    onClose: () => void;
    onSuccess?: () => void;
}

export const ChangeEmailModal: React.FC<ChangeEmailModalProps> = ({
    open,
    user,
    onClose,
    onSuccess,
}) => {
    const [newEmail, setNewEmail] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setNewEmail("");
            setErrorMessage(null);
        }
    }, [open]);

    const handleUpdateEmail = async () => {
        if (!user) {
            return;
        }
        const trimmedEmail = newEmail.trim().toLowerCase();
        if (!trimmedEmail) {
            setErrorMessage("Alamat email baru tidak boleh kosong");
            return;
        }
        if (!EMAIL_REGEX.test(trimmedEmail)) {
            setErrorMessage("Format alamat email tidak valid");
            return;
        }
        if (trimmedEmail === user.email.toLowerCase()) {
            setErrorMessage("Alamat email baru harus berbeda dengan email saat ini");
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);
        try {
            await adminClient.changeEmail({
                userID: user.id,
                email: trimmedEmail,
            });
            onSuccess?.();
            onClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Gagal memperbarui alamat email";
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
                            bgcolor: "rgba(200, 80, 46, 0.12)",
                            color: "#C8502E",
                        }}
                    >
                        <AlternateEmailRoundedIcon />
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                            Perbarui Alamat Email
                        </Typography>
                        <Typography variant="small" sx={{ color: "text.muted" }}>
                            ID Pengguna: #{user?.id}
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

                <TextField
                    label="Email Pengguna Saat Ini"
                    value={user?.email || ""}
                    fullWidth
                    size="small"
                    disabled
                    sx={{ mb: 2.5 }}
                />

                <TextField
                    label="Alamat Email Baru"
                    placeholder="nama@domain.com"
                    type="email"
                    fullWidth
                    size="small"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                    helperText="Pengguna akan menggunakan email ini untuk masuk ke akun Ente/Biyen."
                />
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={isLoading} color="inherit">
                    Batal
                </Button>
                <Button
                    onClick={handleUpdateEmail}
                    disabled={isLoading || !newEmail.trim()}
                    variant="contained"
                    color="accent"
                    sx={{ minWidth: 140, fontWeight: 600 }}
                >
                    {isLoading ? <CircularProgress size={20} color="inherit" /> : "Perbarui Email"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
