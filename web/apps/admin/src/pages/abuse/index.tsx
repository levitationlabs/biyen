import React, { useState, useEffect, useCallback } from "react";
import {
    Box,
    Typography,
    Button,
    TextField,
    InputAdornment,
    Tabs,
    Tab,
    CircularProgress,
    Alert,
    Snackbar,
} from "@mui/material";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

import type { AbuseReport } from "@/types/admin";
import { adminClient } from "@/services/adminClient";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { StatCard } from "@/components/common/StatCard";
import {
    AbuseReportCard,
    AbuseEmptyState,
    computeAbuseMetrics,
    filterAbuseReports,
} from "@/components/abuse";
import type { AbuseStatusFilter } from "@/components/abuse";

const AbuseCenterPage: React.FC = () => {
    const [reports, setReports] = useState<AbuseReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const [statusFilter, setStatusFilter] = useState<AbuseStatusFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");

    const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

    const loadReports = useCallback(async () => {
        setIsLoading(true);
        setFetchError(null);
        try {
            const data = await adminClient.getAbuseReports();
            setReports(data || []);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Gagal memuat daftar laporan abuse";
            setFetchError(message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadReports();
    }, [loadReports]);

    const metrics = computeAbuseMetrics(reports);
    const filteredReports = filterAbuseReports({
        reports,
        filter: statusFilter,
        searchQuery,
    });

    const handleReportUpdated = (updatedReport: AbuseReport) => {
        setReports((prev) =>
            prev.map((item) => (item.id === updatedReport.id ? updatedReport : item))
        );
        setSnackbarMessage(
            `Tautan untuk laporan #${updatedReport.id} berhasil dinonaktifkan (takedown).`
        );
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: AbuseStatusFilter) => {
        setStatusFilter(newValue);
    };

    const handleResetFilter = () => {
        setStatusFilter("all");
        setSearchQuery("");
    };

    return (
        <AdminLayout
            title="Pusat Laporan Pelanggaran (Abuse Center)"
            breadcrumbs={[{ label: "Biyen Admin", href: "/" }, { label: "Abuse Center" }]}
        >
            {/* Header Title & Refresh Button */}
            <Box
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 2,
                    mb: 4,
                }}
            >
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                        Pusat Laporan Pelanggaran (Abuse Center)
                    </Typography>
                    <Typography variant="body" sx={{ color: "text.muted" }}>
                        Pantau, verifikasi, dan lakukan tindakan takedown segera terhadap tautan album/foto publik yang dilaporkan.
                    </Typography>
                </Box>

                <Button
                    variant="outlined"
                    size="small"
                    startIcon={
                        isLoading ? <CircularProgress size={16} /> : <RefreshRoundedIcon />
                    }
                    onClick={loadReports}
                    disabled={isLoading}
                    sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}
                >
                    Segarkan Data
                </Button>
            </Box>

            {/* Metric Summary Cards Grid */}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        sm: "1fr 1fr",
                        md: "repeat(3, 1fr)",
                    },
                    gap: 3,
                    mb: 4,
                }}
            >
                <StatCard
                    title="Total Laporan"
                    value={metrics.total}
                    subtitle="Semua laporan publik tercatat"
                    icon={<ShieldRoundedIcon />}
                    color="#C8502E"
                />
                <StatCard
                    title="Laporan Terbuka"
                    value={metrics.open}
                    subtitle="Perlu tinjauan & tindakan"
                    icon={<WarningAmberRoundedIcon />}
                    color="#EA3F3F"
                />
                <StatCard
                    title="Tautan Ditakedown"
                    value={metrics.resolved}
                    subtitle="Telah berhasil dinonaktifkan"
                    icon={<CheckCircleRoundedIcon />}
                    color="#2E7D32"
                />
            </Box>

            {/* Controls: Status Filter Tabs & Search Bar */}
            <Box
                sx={{
                    display: "flex",
                    flexDirection: { xs: "column", md: "row" },
                    justifyContent: "space-between",
                    alignItems: { xs: "stretch", md: "center" },
                    gap: 2,
                    mb: 3,
                }}
            >
                <Tabs
                    value={statusFilter}
                    onChange={handleTabChange}
                    sx={{
                        minHeight: 40,
                        "& .MuiTab-root": {
                            minHeight: 40,
                            py: 0.5,
                            textTransform: "none",
                            fontWeight: 600,
                            fontSize: "0.875rem",
                        },
                    }}
                >
                    <Tab value="all" label={`Semua (${metrics.total})`} />
                    <Tab value="open" label={`Perlu Tindakan (${metrics.open})`} />
                    <Tab value="resolved" label={`Selesai (${metrics.resolved})`} />
                </Tabs>

                <TextField
                    size="small"
                    placeholder="Cari URL, alasan, atau IP..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    sx={{ width: { xs: "100%", md: 320 } }}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchRoundedIcon fontSize="small" sx={{ color: "text.muted" }} />
                                </InputAdornment>
                            ),
                        },
                    }}
                />
            </Box>

            {/* Fetch Error Alert */}
            {fetchError && (
                <Alert
                    severity="error"
                    sx={{ mb: 3, borderRadius: 2 }}
                    action={
                        <Button color="inherit" size="small" onClick={loadReports}>
                            Coba Lagi
                        </Button>
                    }
                >
                    {fetchError}
                </Alert>
            )}

            {/* Loading Indicator */}
            {isLoading && (
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        py: 8,
                    }}
                >
                    <CircularProgress color="inherit" size={32} />
                </Box>
            )}

            {/* Reports List or Empty State */}
            {!isLoading && filteredReports.length === 0 && (
                <AbuseEmptyState
                    filter={statusFilter}
                    hasSearchQuery={Boolean(searchQuery.trim())}
                    onResetFilter={handleResetFilter}
                />
            )}

            {!isLoading && filteredReports.length > 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                    {filteredReports.map((report) => (
                        <AbuseReportCard
                            key={report.id}
                            report={report}
                            onReportUpdated={handleReportUpdated}
                        />
                    ))}
                </Box>
            )}

            {/* Toast Feedback Notification */}
            <Snackbar
                open={Boolean(snackbarMessage)}
                autoHideDuration={4000}
                onClose={() => setSnackbarMessage(null)}
                message={snackbarMessage}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            />
        </AdminLayout>
    );
};

export default AbuseCenterPage;
