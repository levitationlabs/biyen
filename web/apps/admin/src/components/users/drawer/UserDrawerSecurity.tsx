// Biyen Admin — User Drawer Security Section
// Copyright 2026 Levitation — AGPL-3.0-or-later

import React from "react";
import {
    Box,
    Typography,
    Paper,
    Button,
    Stack,
    Chip,
    alpha,
} from "@mui/material";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import VpnKeyRoundedIcon from "@mui/icons-material/VpnKeyRounded";
import FingerprintRoundedIcon from "@mui/icons-material/FingerprintRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import type { AdminUser } from "@/types/admin";

export interface UserDrawerSecurityProps {
    user: AdminUser;
    authCodes?: number;
    onOpenSecurityModal: () => void;
}

export const UserDrawerSecurity: React.FC<UserDrawerSecurityProps> = ({
    user,
    authCodes = 0,
    onOpenSecurityModal,
}) => {
    const is2faActive = Boolean(user.isTwoFactorEnabled);
    const isMfaActive = Boolean(user.isEmailMFAEnabled);
    const passkeysCount = authCodes ?? 0;

    return (
        <Paper
            elevation={0}
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
                    <SecurityRoundedIcon sx={{ color: "primary.main", fontSize: 20 }} />
                    <Typography variant="body" sx={{ fontWeight: 700 }}>
                        Keamanan Akun
                    </Typography>
                </Box>
                <Button
                    size="small"
                    variant="text"
                    onClick={onOpenSecurityModal}
                    sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.8125rem" }}
                >
                    Kelola Keamanan
                </Button>
            </Box>

            <Stack spacing={1.5}>
                {/* 2FA TOTP */}
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: (t) => alpha(t.palette.text.primary, 0.02),
                        border: "1px solid",
                        borderColor: "divider",
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <VpnKeyRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                        <Box>
                            <Typography variant="body" sx={{ fontWeight: 600 }}>
                                Two-Factor Auth (TOTP)
                            </Typography>
                            <Typography variant="small" sx={{ color: "text.secondary", display: "block" }}>
                                Autentikator Google / Ente Auth
                            </Typography>
                        </Box>
                    </Box>
                    <Chip
                        label={is2faActive ? "Aktif" : "Nonaktif"}
                        size="small"
                        color={is2faActive ? "success" : "default"}
                        variant={is2faActive ? "filled" : "outlined"}
                    />
                </Box>

                {/* Passkeys */}
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: (t) => alpha(t.palette.text.primary, 0.02),
                        border: "1px solid",
                        borderColor: "divider",
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <FingerprintRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                        <Box>
                            <Typography variant="body" sx={{ fontWeight: 600 }}>
                                Kredensial Passkey
                            </Typography>
                            <Typography variant="small" sx={{ color: "text.secondary", display: "block" }}>
                                WebAuthn / FIDO2 Hardware Key
                            </Typography>
                        </Box>
                    </Box>
                    <Chip
                        label={`${passkeysCount} Terdaftar`}
                        size="small"
                        color={passkeysCount > 0 ? "primary" : "default"}
                        variant={passkeysCount > 0 ? "filled" : "outlined"}
                    />
                </Box>

                {/* Email MFA */}
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: (t) => alpha(t.palette.text.primary, 0.02),
                        border: "1px solid",
                        borderColor: "divider",
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <MarkEmailReadRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                        <Box>
                            <Typography variant="body" sx={{ fontWeight: 600 }}>
                                Verifikasi Email (MFA)
                            </Typography>
                            <Typography variant="small" sx={{ color: "text.secondary", display: "block" }}>
                                Kode OTP saat login ke perangkat baru
                            </Typography>
                        </Box>
                    </Box>
                    <Chip
                        label={isMfaActive ? "Aktif" : "Nonaktif"}
                        size="small"
                        color={isMfaActive ? "info" : "default"}
                        variant={isMfaActive ? "filled" : "outlined"}
                    />
                </Box>
            </Stack>
        </Paper>
    );
};
