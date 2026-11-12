// Biyen Admin — User Management Page
// Copyright 2026 Levitation — AGPL-3.0-or-later

import React, { useState, useEffect, useCallback } from "react";
import {
    Box,
    Typography,
    Button,
    Alert,
    Snackbar,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import type { AdminUser, UserSubscription } from "@/types/admin";
import { adminClient } from "@/services/adminClient";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ConfirmDangerDialog } from "@/components/dialogs/ConfirmDangerDialog";
import { UserTable } from "@/components/users/UserTable";
import { UserDetailDrawer } from "@/components/users/UserDetailDrawer";
import {
    QuotaModal,
    BonusModal,
    SuspendModal,
    SecurityModal,
    ChangeEmailModal,
} from "@/components/users/modals";

const BREADCRUMBS = [
    { label: "Biyen Admin", href: "/" },
    { label: "Pengguna" },
];

export const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);

    // Selected user for drawer
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Target user for active modals
    const [userForModal, setUserForModal] = useState<AdminUser | null>(null);
    const [activeSubscription, setActiveSubscription] = useState<UserSubscription | null>(null);

    // Modal open states
    const [quotaModalOpen, setQuotaModalOpen] = useState(false);
    const [bonusModalOpen, setBonusModalOpen] = useState(false);
    const [suspendModalOpen, setSuspendModalOpen] = useState(false);
    const [securityModalOpen, setSecurityModalOpen] = useState(false);
    const [changeEmailModalOpen, setChangeEmailModalOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Toast feedback
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setPageError(null);
        try {
            const list = await adminClient.getUsers();
            setUsers(list);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Gagal memuat daftar pengguna";
            setPageError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const handleSelectUser = (user: AdminUser) => {
        setSelectedUser(user);
        setDrawerOpen(true);
    };

    const handleCloseDrawer = () => {
        setDrawerOpen(false);
        setSelectedUser(null);
    };

    // Modal triggers
    const handleOpenQuota = (user: AdminUser, sub?: UserSubscription) => {
        setUserForModal(user);
        setActiveSubscription(sub ?? null);
        setQuotaModalOpen(true);
    };

    const handleOpenBonus = (user: AdminUser) => {
        setUserForModal(user);
        setBonusModalOpen(true);
    };

    const handleOpenSuspend = (user: AdminUser) => {
        setUserForModal(user);
        setSuspendModalOpen(true);
    };

    const handleOpenChangeEmail = (user: AdminUser) => {
        setUserForModal(user);
        setChangeEmailModalOpen(true);
    };

    const handleOpenSecurity = (user: AdminUser) => {
        setUserForModal(user);
        setSecurityModalOpen(true);
    };

    const handleTriggerDelete = (user: AdminUser) => {
        setUserForModal(user);
        setDeleteDialogOpen(true);
    };

    const handleModalSuccess = (feedback: string) => {
        setToastMessage(feedback);
        loadUsers();
    };

    const handleConfirmDelete = async () => {
        if (!userForModal) return;
        setIsDeleting(true);
        try {
            await adminClient.deleteUser(userForModal.email);
            setToastMessage(`Akun ${userForModal.email} berhasil dihapus permanen`);
            setDeleteDialogOpen(false);
            handleCloseDrawer();
            await loadUsers();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Gagal menghapus pengguna";
            setToastMessage(`Error: ${msg}`);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AdminLayout title="Manajemen Pengguna" breadcrumbs={BREADCRUMBS}>
            {/* Page Header */}
            <Box
                sx={{
                    mb: 3.5,
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    justifyContent: "space-between",
                    alignItems: { xs: "flex-start", sm: "center" },
                    gap: 2,
                }}
            >
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                        Manajemen Pengguna
                    </Typography>
                    <Typography variant="body" sx={{ color: "text.secondary" }}>
                        Kelola akun, alokasi penyimpanan, kredensial keamanan, dan pantau sesi aktif pengguna Biyen.
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    startIcon={<RefreshRoundedIcon />}
                    onClick={loadUsers}
                    disabled={loading}
                    sx={{ textTransform: "none", borderRadius: 2 }}
                >
                    Muat Ulang
                </Button>
            </Box>

            {/* Error Banner */}
            {pageError && (
                <Alert
                    severity="error"
                    sx={{ mb: 3 }}
                    action={
                        <Button color="inherit" size="small" onClick={loadUsers}>
                            Ulangi
                        </Button>
                    }
                >
                    {pageError}
                </Alert>
            )}

            {/* Main User Table */}
            <UserTable
                users={users}
                loading={loading}
                onSelectUser={handleSelectUser}
            />

            {/* Side Drawer User Details */}
            <UserDetailDrawer
                open={drawerOpen}
                user={selectedUser}
                onClose={handleCloseDrawer}
                onOpenQuota={handleOpenQuota}
                onOpenBonus={handleOpenBonus}
                onOpenSuspend={handleOpenSuspend}
                onOpenChangeEmail={handleOpenChangeEmail}
                onOpenSecurity={handleOpenSecurity}
                onTriggerDelete={handleTriggerDelete}
                onUserUpdated={loadUsers}
            />

            {/* User Action Modals */}
            <QuotaModal
                open={quotaModalOpen}
                user={userForModal}
                currentSubscription={activeSubscription}
                onClose={() => setQuotaModalOpen(false)}
                onSuccess={() => handleModalSuccess("Kuota langganan berhasil diperbarui")}
            />

            <BonusModal
                open={bonusModalOpen}
                user={userForModal}
                onClose={() => setBonusModalOpen(false)}
                onSuccess={() => handleModalSuccess("Bonus penyimpanan berhasil diperbarui")}
            />

            <SuspendModal
                open={suspendModalOpen}
                user={userForModal}
                onClose={() => setSuspendModalOpen(false)}
                onSuccess={() => handleModalSuccess("Status penangguhan akun berhasil diperbarui")}
            />

            <SecurityModal
                open={securityModalOpen}
                user={userForModal}
                onClose={() => setSecurityModalOpen(false)}
                onSuccess={() => handleModalSuccess("Konfigurasi keamanan akun berhasil diperbarui")}
            />

            <ChangeEmailModal
                open={changeEmailModalOpen}
                user={userForModal}
                onClose={() => setChangeEmailModalOpen(false)}
                onSuccess={() => handleModalSuccess("Alamat email pengguna berhasil diubah")}
            />

            <ConfirmDangerDialog
                open={deleteDialogOpen}
                title={`Hapus Akun Pengguna #${userForModal?.id ?? ""}`}
                description={`Tindakan ini tidak dapat dibatalkan. Seluruh foto arsip, dokumen locker, dan enkripsi akun ${userForModal?.email ?? ""} akan dihapus secara permanen.`}
                confirmTextKeyword={userForModal?.email ?? ""}
                loading={isDeleting}
                onConfirm={handleConfirmDelete}
                onClose={() => setDeleteDialogOpen(false)}
            />

            {/* Toast Feedback */}
            <Snackbar
                open={Boolean(toastMessage)}
                autoHideDuration={4000}
                onClose={() => setToastMessage(null)}
                message={toastMessage}
            />
        </AdminLayout>
    );
};

export default UsersPage;
