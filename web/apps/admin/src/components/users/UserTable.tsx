// Biyen Admin — User Management Table
// Copyright 2026 Levitation — AGPL-3.0-or-later

import React, { useState, useMemo } from "react";
import {
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TablePagination,
    TextField,
    InputAdornment,
    Stack,
    Box,
    Paper,
    TableContainer,
    Chip,
    Button,
    Typography,
    CircularProgress,
    alpha,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import type { AdminUser } from "@/types/admin";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
    formatRegistrationDate,
    filterUsers,
    type UserStatusFilter,
} from "./userHelpers";

export interface UserTableProps {
    users: AdminUser[];
    loading: boolean;
    onSelectUser: (user: AdminUser) => void;
}

const DEFAULT_ROWS_PER_PAGE = 10;
const ROWS_PER_PAGE_OPTIONS = [5, 10, 25, 50];

export const UserTable: React.FC<UserTableProps> = ({
    users,
    loading,
    onSelectUser,
}) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

    const counts = useMemo(() => {
        let active = 0;
        let suspended = 0;
        for (const user of users) {
            if (user.isSuspended) {
                suspended += 1;
            } else {
                active += 1;
            }
        }
        return { all: users.length, active, suspended };
    }, [users]);

    const filteredUsers = useMemo(() => {
        return filterUsers({ users, searchQuery, statusFilter });
    }, [users, searchQuery, statusFilter]);

    const paginatedUsers = useMemo(() => {
        const startIndex = page * rowsPerPage;
        return filteredUsers.slice(startIndex, startIndex + rowsPerPage);
    }, [filteredUsers, page, rowsPerPage]);

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(event.target.value);
        setPage(0);
    };

    const handleStatusFilterChange = (filter: UserStatusFilter) => {
        setStatusFilter(filter);
        setPage(0);
    };

    const handlePageChange = (_: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    return (
        <Paper
            elevation={0}
            sx={{
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                overflow: "hidden",
                bgcolor: "background.paper",
            }}
        >
            {/* Table Controls Header: Search & Filter Chips */}
            <Box
                sx={{
                    p: 2.5,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    justifyContent: "space-between",
                    alignItems: { xs: "stretch", sm: "center" },
                    gap: 2,
                }}
            >
                <TextField
                    size="small"
                    placeholder="Cari ID atau email pengguna..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchRoundedIcon sx={{ color: "text.secondary", fontSize: 20 }} />
                                </InputAdornment>
                            ),
                        },
                    }}
                    sx={{ width: { xs: "100%", sm: 320 } }}
                />

                <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: { xs: 0.5, sm: 0 } }}>
                    <Chip
                        label={`Semua (${counts.all})`}
                        clickable
                        color={statusFilter === "all" ? "primary" : "default"}
                        variant={statusFilter === "all" ? "filled" : "outlined"}
                        onClick={() => handleStatusFilterChange("all")}
                        size="small"
                    />
                    <Chip
                        label={`Aktif (${counts.active})`}
                        clickable
                        color={statusFilter === "active" ? "primary" : "default"}
                        variant={statusFilter === "active" ? "filled" : "outlined"}
                        onClick={() => handleStatusFilterChange("active")}
                        size="small"
                    />
                    <Chip
                        label={`Ditangguhkan (${counts.suspended})`}
                        clickable
                        color={statusFilter === "suspended" ? "error" : "default"}
                        variant={statusFilter === "suspended" ? "filled" : "outlined"}
                        onClick={() => handleStatusFilterChange("suspended")}
                        size="small"
                    />
                </Stack>
            </Box>

            {/* Table Container */}
            <TableContainer>
                <Table sx={{ minWidth: 700 }} aria-label="tabel pengguna">
                    <TableHead sx={{ bgcolor: (t) => alpha(t.palette.text.primary, 0.02) }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700, width: 100 }}>User ID</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Email Pengguna</TableCell>
                            <TableCell sx={{ fontWeight: 700, width: 150 }}>Tanggal Daftar</TableCell>
                            <TableCell sx={{ fontWeight: 700, width: 140 }}>Status Akun</TableCell>
                            <TableCell sx={{ fontWeight: 700, width: 160 }}>Keamanan</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, width: 120 }}>Aksi</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading && users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                                    <CircularProgress size={32} />
                                    <Typography variant="body" sx={{ mt: 1.5, color: "text.secondary", display: "block" }}>
                                        Memuat daftar pengguna...
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : paginatedUsers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                                    <PersonOutlineRoundedIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                                    <Typography variant="body" sx={{ fontWeight: 600 }}>
                                        Tidak ada pengguna ditemukan
                                    </Typography>
                                    <Typography variant="body" sx={{ color: "text.secondary", display: "block" }}>
                                        Coba ubah kata kunci pencarian atau filter status.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedUsers.map((user) => (
                                <TableRow
                                    key={user.id}
                                    hover
                                    sx={{
                                        cursor: "pointer",
                                        "&:last-child td, &:last-child th": { border: 0 },
                                    }}
                                    onClick={() => onSelectUser(user)}
                                >
                                    <TableCell component="th" scope="row">
                                        <Typography variant="body" sx={{ fontFamily: "monospace", fontWeight: 700 }}>
                                            #{user.id}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body" sx={{ fontWeight: 600, color: "text.primary" }}>
                                            {user.email}
                                        </Typography>
                                        {user.name && (
                                            <Typography variant="small" sx={{ color: "text.secondary", display: "block" }}>
                                                {user.name}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body" sx={{ color: "text.secondary" }}>
                                            {formatRegistrationDate(user.creationTime)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge
                                            status={user.isSuspended ? "Ditangguhkan" : "Aktif"}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
                                            {user.isTwoFactorEnabled && (
                                                <Chip
                                                    label="2FA"
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                    sx={{ fontSize: "0.7rem", height: 20 }}
                                                />
                                            )}
                                            {user.isEmailMFAEnabled && (
                                                <Chip
                                                    label="MFA"
                                                    size="small"
                                                    color="info"
                                                    variant="outlined"
                                                    sx={{ fontSize: "0.7rem", height: 20 }}
                                                />
                                            )}
                                            {!user.isTwoFactorEnabled && !user.isEmailMFAEnabled && (
                                                <Typography variant="small" sx={{ color: "text.disabled" }}>
                                                    Nonaktif
                                                </Typography>
                                            )}
                                        </Stack>
                                    </TableCell>
                                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                                            onClick={() => onSelectUser(user)}
                                            sx={{ borderRadius: 2, textTransform: "none" }}
                                        >
                                            Kelola
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Table Pagination */}
            <TablePagination
                rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
                component="div"
                count={filteredUsers.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handlePageChange}
                onRowsPerPageChange={handleRowsPerPageChange}
                labelRowsPerPage="Baris per halaman:"
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} dari ${count}`}
            />
        </Paper>
    );
};
