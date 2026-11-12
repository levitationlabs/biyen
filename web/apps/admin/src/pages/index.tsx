import React, { useState } from "react";
import {
    Box,
    Typography,
    Card,
    CardContent,
    Button,
    Divider,
} from "@mui/material";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import VpnKeyRoundedIcon from "@mui/icons-material/VpnKeyRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { StatCard } from "@/components/common/StatCard";
import { QuotaProgress } from "@/components/common/QuotaProgress";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDangerDialog } from "@/components/dialogs/ConfirmDangerDialog";

const AdminDashboard: React.FC = () => {
    const [dangerDialogOpen, setDangerDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleOpenDangerDialog = () => {
        setDangerDialogOpen(true);
    };

    const handleCloseDangerDialog = () => {
        setDangerDialogOpen(false);
    };

    const handleConfirmDangerAction = () => {
        setIsDeleting(true);
        setTimeout(() => {
            setIsDeleting(false);
            setDangerDialogOpen(false);
        }, 1000);
    };

    return (
        <AdminLayout
            title="Dashboard Overview"
            breadcrumbs={[{ label: "Biyen Admin", href: "/" }, { label: "Dashboard" }]}
        >
            <Box sx={{ mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Selamat Datang di Biyen Admin
                </Typography>
                <Typography variant="body" sx={{ color: "text.muted" }}>
                    Kelola akun pengguna, alokasi kuota penyimpanan, dan moderasi konten arsip foto.
                </Typography>
            </Box>

            {/* Metric Summary Cards Grid */}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        sm: "1fr 1fr",
                        md: "repeat(4, 1fr)",
                    },
                    gap: 3,
                    mb: 4,
                }}
            >
                <StatCard
                    title="Total Pengguna"
                    value="1,248"
                    subtitle="+12 minggu ini"
                    icon={<PeopleAltRoundedIcon />}
                    color="#C8502E"
                />
                <StatCard
                    title="Penyimpanan Terpakai"
                    value="1.24 TB"
                    subtitle="dari 10 TB total server"
                    icon={<StorageRoundedIcon />}
                    color="#2E7D32"
                />
                <StatCard
                    title="Laporan Abuse"
                    value="3"
                    subtitle="Perlu penanganan segera"
                    icon={<ShieldRoundedIcon />}
                    color="#EA3F3F"
                />
                <StatCard
                    title="Sesi Aktif"
                    value="412"
                    subtitle="Web, Desktop & Mobile"
                    icon={<VpnKeyRoundedIcon />}
                    color="#0288D1"
                />
            </Box>

            {/* Storage Quota & Status Showcase Grid */}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        md: "1fr 1fr",
                    },
                    gap: 3,
                }}
            >
                <Card
                    sx={{
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: "divider",
                        boxShadow: "none",
                    }}
                >
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                            Kapasitas Penyimpanan Global
                        </Typography>
                        <Box sx={{ mb: 3 }}>
                            <QuotaProgress
                                usedBytes={12.4 * 1024 * 1024 * 1024}
                                totalBytes={100 * 1024 * 1024 * 1024}
                                label="Server Storage Pool (Biyen Primary)"
                            />
                        </Box>
                        <Box>
                            <QuotaProgress
                                usedBytes={93.5 * 1024 * 1024 * 1024}
                                totalBytes={100 * 1024 * 1024 * 1024}
                                label="Server Storage Backup (Peringatan >90%)"
                            />
                        </Box>
                    </CardContent>
                </Card>

                <Card
                    sx={{
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: "divider",
                        boxShadow: "none",
                    }}
                >
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                            Status Akun & Tindakan Proteksi
                        </Typography>

                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 3 }}>
                            <StatusBadge status="Aktif" />
                            <StatusBadge status="Ditangguhkan" />
                            <StatusBadge status="MFA Aktif" />
                            <StatusBadge status="2FA Nonaktif" />
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Box>
                            <Typography variant="small" sx={{ display: "block", color: "text.muted", mb: 1.5 }}>
                                Demonstrasi Modal Konfirmasi Bahaya (Proteksi Ganda):
                            </Typography>
                            <Button
                                variant="outlined"
                                color="critical"
                                size="small"
                                startIcon={<WarningAmberRoundedIcon />}
                                onClick={handleOpenDangerDialog}
                                sx={{ borderRadius: 1.5, textTransform: "none" }}
                            >
                                Uji Dialog Tindakan Berbahaya
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            </Box>

            {/* Double Protection Dialog */}
            <ConfirmDangerDialog
                open={dangerDialogOpen}
                title="Hapus Akun Pengguna Secara Permanen"
                description="Tindakan ini akan menghapus seluruh data enkripsi, metadata, dan kuota pengguna. Tindakan ini tidak dapat dibatalkan."
                confirmTextKeyword="admin@ente.io"
                onConfirm={handleConfirmDangerAction}
                onClose={handleCloseDangerDialog}
                loading={isDeleting}
            />
        </AdminLayout>
    );
};

export default AdminDashboard;
