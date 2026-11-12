import React from "react";
import { Box, Typography, Button, alpha } from "@mui/material";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import FilterAltOffRoundedIcon from "@mui/icons-material/FilterAltOffRounded";
import type { AbuseStatusFilter } from "./abuseUtils";

export interface AbuseEmptyStateProps {
    filter: AbuseStatusFilter;
    hasSearchQuery?: boolean;
    onResetFilter?: () => void;
}

const PRIMARY_TERRACOTTA = "#C8502E";

export const AbuseEmptyState: React.FC<AbuseEmptyStateProps> = ({
    filter,
    hasSearchQuery,
    onResetFilter,
}) => {
    let title = "Tidak Ada Laporan Pelanggaran";
    let description =
        "Saat ini tidak ada laporan penyalahgunaan tautan publik yang tercatat di sistem.";

    if (hasSearchQuery) {
        title = "Tidak Ada Laporan yang Cocok";
        description =
            "Tidak ditemukan laporan pelanggaran yang sesuai dengan kata kunci pencarian Anda.";
    } else if (filter === "open") {
        title = "Semua Laporan Telah Ditangani";
        description =
            "Bagus sekali! Tidak ada laporan pelanggaran aktif yang memerlukan tindakan takedown saat ini.";
    } else if (filter === "resolved") {
        title = "Belum Ada Tautan Ditakedown";
        description =
            "Belum ada catatan laporan yang telah diselesaikan atau dinonaktifkan.";
    }

    return (
        <Box
            sx={{
                p: { xs: 4, sm: 6 },
                textAlign: "center",
                borderRadius: 3,
                border: "1px dashed",
                borderColor: "divider",
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1.5,
                my: 2,
            }}
        >
            <Box
                sx={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: alpha(PRIMARY_TERRACOTTA, 0.1),
                    color: PRIMARY_TERRACOTTA,
                    mb: 1,
                }}
            >
                {hasSearchQuery ? (
                    <FilterAltOffRoundedIcon sx={{ fontSize: 28 }} />
                ) : (
                    <ShieldRoundedIcon sx={{ fontSize: 28 }} />
                )}
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {title}
            </Typography>

            <Typography
                variant="body"
                sx={{ color: "text.muted", maxWidth: 480, lineHeight: 1.6 }}
            >
                {description}
            </Typography>

            {(hasSearchQuery || filter !== "all") && onResetFilter && (
                <Button
                    variant="outlined"
                    size="small"
                    onClick={onResetFilter}
                    sx={{ mt: 1, borderRadius: 1.5, textTransform: "none" }}
                >
                    Reset Filter & Pencarian
                </Button>
            )}
        </Box>
    );
};
