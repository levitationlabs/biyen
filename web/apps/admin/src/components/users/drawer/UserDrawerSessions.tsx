// Biyen Admin — User Drawer Active Sessions Section
// Copyright 2026 Levitation — AGPL-3.0-or-later

import React from "react";
import {
    Box,
    Typography,
    Paper,
    Button,
    Stack,
    Chip,
    CircularProgress,
    alpha,
} from "@mui/material";
import DevicesRoundedIcon from "@mui/icons-material/DevicesRounded";
import PhoneAndroidRoundedIcon from "@mui/icons-material/PhoneAndroidRounded";
import LaptopMacRoundedIcon from "@mui/icons-material/LaptopMacRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import type { UserSessionToken } from "@/types/admin";
import { formatDateTime } from "../userHelpers";

export interface UserDrawerSessionsProps {
    tokens?: UserSessionToken[];
    terminatingToken: string | null;
    onTerminateSession: (tokenString: string) => void;
}

function getDeviceIcon(ua: string) {
    const lower = ua.toLowerCase();
    if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")) {
        return <PhoneAndroidRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} />;
    }
    if (lower.includes("mac") || lower.includes("windows") || lower.includes("linux")) {
        return <LaptopMacRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} />;
    }
    return <PublicRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} />;
}

export const UserDrawerSessions: React.FC<UserDrawerSessionsProps> = ({
    tokens = [],
    terminatingToken,
    onTerminateSession,
}) => {
    const activeTokens = tokens.filter((t) => !t.isDeleted);

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
                    <DevicesRoundedIcon sx={{ color: "primary.main", fontSize: 20 }} />
                    <Typography variant="body" sx={{ fontWeight: 700 }}>
                        Sesi Login Aktif ({activeTokens.length})
                    </Typography>
                </Box>
            </Box>

            {activeTokens.length === 0 ? (
                <Box sx={{ py: 3, textAlign: "center" }}>
                    <Typography variant="body" sx={{ color: "text.secondary" }}>
                        Tidak ada sesi login aktif saat ini.
                    </Typography>
                </Box>
            ) : (
                <Stack spacing={1.5}>
                    {activeTokens.map((session, index) => {
                        const tokenKey = session.token || `token-${index}`;
                        const isTerminating = terminatingToken === tokenKey;

                        return (
                            <Box
                                key={tokenKey}
                                sx={{
                                    p: 1.5,
                                    borderRadius: 2,
                                    bgcolor: (t) => alpha(t.palette.text.primary, 0.02),
                                    border: "1px solid",
                                    borderColor: "divider",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 1,
                                }}
                            >
                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                                    <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
                                        <Box sx={{ mt: 0.25 }}>{getDeviceIcon(session.ua || "")}</Box>
                                        <Box>
                                            <Typography variant="body" sx={{ fontWeight: 600, wordBreak: "break-all" }}>
                                                {session.ua || "Aplikasi Biyen / Klien"}
                                            </Typography>
                                            <Stack direction="row" spacing={1} sx={{ mt: 0.25, alignItems: "center" }}>
                                                <Chip
                                                    label={session.app || "biyen-app"}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ fontSize: "0.68rem", height: 18 }}
                                                />
                                                <Typography variant="small" sx={{ color: "text.secondary" }}>
                                                    Aktif: {formatDateTime(session.lastUsedTime)}
                                                </Typography>
                                            </Stack>
                                        </Box>
                                    </Box>

                                    {session.token && (
                                        <Button
                                            size="small"
                                            color="critical"
                                            variant="outlined"
                                            disabled={Boolean(terminatingToken)}
                                            onClick={() => onTerminateSession(session.token!)}
                                            sx={{
                                                textTransform: "none",
                                                borderRadius: 1.5,
                                                fontSize: "0.75rem",
                                                py: 0.25,
                                                px: 1,
                                                flexShrink: 0,
                                            }}
                                        >
                                            {isTerminating ? (
                                                <CircularProgress size={14} color="inherit" />
                                            ) : (
                                                "Cabut Sesi"
                                            )}
                                        </Button>
                                    )}
                                </Box>
                            </Box>
                        );
                    })}
                </Stack>
            )}
        </Paper>
    );
};
