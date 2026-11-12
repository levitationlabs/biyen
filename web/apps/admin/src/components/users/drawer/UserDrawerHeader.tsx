// Biyen Admin — User Drawer Header
// Copyright 2026 Levitation — AGPL-3.0-or-later

import React from "react";
import {
    Box,
    Typography,
    Avatar,
    IconButton,
    Stack,
    alpha,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import type { AdminUser } from "@/types/admin";
import { StatusBadge } from "@/components/common/StatusBadge";

export interface UserDrawerHeaderProps {
    user: AdminUser;
    onClose: () => void;
}

export const UserDrawerHeader: React.FC<UserDrawerHeaderProps> = ({
    user,
    onClose,
}) => {
    const avatarLetter = (user.name || user.email || "?").charAt(0).toUpperCase();

    return (
        <Box
            sx={{
                p: 3,
                borderBottom: "1px solid",
                borderColor: "divider",
                bgcolor: (t) => alpha(t.palette.text.primary, 0.02),
                position: "sticky",
                top: 0,
                zIndex: 1,
            }}
        >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                    <Avatar
                        sx={{
                            width: 52,
                            height: 52,
                            bgcolor: "primary.main",
                            fontWeight: 700,
                            fontSize: "1.25rem",
                        }}
                    >
                        {avatarLetter}
                    </Avatar>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                            {user.email}
                        </Typography>
                        {user.name && (
                            <Typography variant="body" sx={{ color: "text.secondary" }}>
                                {user.name}
                            </Typography>
                        )}
                        <Stack direction="row" spacing={1} sx={{ mt: 0.75, alignItems: "center" }}>
                            <Typography
                                variant="small"
                                sx={{
                                    fontFamily: "monospace",
                                    bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                                    px: 0.75,
                                    py: 0.25,
                                    borderRadius: 1,
                                    fontWeight: 700,
                                }}
                            >
                                ID #{user.id}
                            </Typography>
                            <StatusBadge
                                status={user.isSuspended ? "Ditangguhkan" : "Aktif"}
                                size="small"
                            />
                        </Stack>
                    </Box>
                </Box>
                <IconButton onClick={onClose} size="small" aria-label="Tutup drawer">
                    <CloseRoundedIcon />
                </IconButton>
            </Box>
        </Box>
    );
};
