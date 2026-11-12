// Biyen Admin — User Drawer Storage Section
// Copyright 2026 Levitation — AGPL-3.0-or-later

import React from "react";
import {
    Box,
    Typography,
    Paper,
    Stack,
    Divider,
    alpha,
} from "@mui/material";
import PhotoLibraryRoundedIcon from "@mui/icons-material/PhotoLibraryRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import type { AdminUserDetails } from "@/types/admin";
import { QuotaProgress } from "@/components/common/QuotaProgress";
import { formatRegistrationDate } from "../userHelpers";

export interface UserDrawerStorageProps {
    details: AdminUserDetails;
}

export const UserDrawerStorage: React.FC<UserDrawerStorageProps> = ({ details }) => {
    const usedBytes = details.storageConsumed ?? 0;
    const totalBytes = details.subscription?.storage ?? 0;
    const photosCount = details.photosFileCount ?? 0;
    const lockerCount = details.lockerFileCount ?? 0;
    const expiryMicro = details.subscription?.expiryTime ?? 0;

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
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <StorageRoundedIcon sx={{ color: "primary.main", fontSize: 20 }} />
                <Typography variant="body" sx={{ fontWeight: 700 }}>
                    Ringkasan Penyimpanan
                </Typography>
            </Box>

            {/* Quota Progress Bar */}
            <QuotaProgress
                usedBytes={usedBytes}
                totalBytes={totalBytes}
                label="Konsumsi Kuota Akun"
                sx={{ mb: 2.5 }}
            />

            <Divider sx={{ my: 2 }} />

            {/* Breakdown Files Grid */}
            <Typography variant="small" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1.5 }}>
                Rincian Berkas Tersimpan
            </Typography>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 1.5,
                }}
            >
                <Box
                    sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: (t) => alpha(t.palette.text.primary, 0.03),
                        border: "1px solid",
                        borderColor: "divider",
                    }}
                >
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                        <PhotoLibraryRoundedIcon sx={{ fontSize: 16, color: "primary.main" }} />
                        <Typography variant="small" sx={{ color: "text.secondary", fontWeight: 600 }}>
                            Galeri Foto
                        </Typography>
                    </Stack>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {photosCount.toLocaleString("id-ID")}
                    </Typography>
                    <Typography variant="small" sx={{ color: "text.disabled" }}>
                        item foto / video
                    </Typography>
                </Box>

                <Box
                    sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: (t) => alpha(t.palette.text.primary, 0.03),
                        border: "1px solid",
                        borderColor: "divider",
                    }}
                >
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                        <LockRoundedIcon sx={{ fontSize: 16, color: "info.main" }} />
                        <Typography variant="small" sx={{ color: "text.secondary", fontWeight: 600 }}>
                            Dokumen Locker
                        </Typography>
                    </Stack>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {lockerCount.toLocaleString("id-ID")}
                    </Typography>
                    <Typography variant="small" sx={{ color: "text.disabled" }}>
                        item terenkripsi
                    </Typography>
                </Box>
            </Box>

            {/* Subscription Expiry Footer */}
            {expiryMicro > 0 && (
                <Box sx={{ mt: 2, pt: 1.5, borderTop: "1px dashed", borderColor: "divider" }}>
                    <Typography variant="small" sx={{ color: "text.secondary", display: "flex", justifyContent: "space-between" }}>
                        <span>Kedaluwarsa Paket:</span>
                        <strong>{formatRegistrationDate(expiryMicro)}</strong>
                    </Typography>
                </Box>
            )}
        </Paper>
    );
};
