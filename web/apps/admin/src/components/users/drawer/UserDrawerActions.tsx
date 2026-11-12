// Biyen Admin — User Drawer Quick Admin Actions Toolbar
// Copyright 2026 Levitation — AGPL-3.0-or-later

import React from "react";
import {
    Box,
    Typography,
    Paper,
    Button,
    Stack,
    CircularProgress,
    alpha,
} from "@mui/material";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CardGiftcardRoundedIcon from "@mui/icons-material/CardGiftcardRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import HandymanRoundedIcon from "@mui/icons-material/HandymanRounded";

export interface UserDrawerActionsProps {
    isSuspended: boolean;
    isUnsuspending: boolean;
    onOpenQuota: () => void;
    onOpenBonus: () => void;
    onOpenSuspend: () => void;
    onUnsuspend: () => void;
    onOpenChangeEmail: () => void;
    onTriggerDelete: () => void;
}

export const UserDrawerActions: React.FC<UserDrawerActionsProps> = ({
    isSuspended,
    isUnsuspending,
    onOpenQuota,
    onOpenBonus,
    onOpenSuspend,
    onUnsuspend,
    onOpenChangeEmail,
    onTriggerDelete,
}) => {
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
                <HandymanRoundedIcon sx={{ color: "primary.main", fontSize: 20 }} />
                <Typography variant="body" sx={{ fontWeight: 700 }}>
                    Aksi Cepat Admin
                </Typography>
            </Box>

            <Stack spacing={1.5}>
                {/* Ubah Kuota Storage */}
                <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<BoltRoundedIcon sx={{ color: "#E65100" }} />}
                    onClick={onOpenQuota}
                    sx={{
                        justifyContent: "flex-start",
                        textTransform: "none",
                        fontWeight: 600,
                        py: 1,
                        borderRadius: 2,
                        borderColor: "divider",
                        "&:hover": { bgcolor: (t) => alpha(t.palette.text.primary, 0.04) },
                    }}
                >
                    Ubah Kuota Storage
                </Button>

                {/* Tambah Bonus Storage */}
                <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<CardGiftcardRoundedIcon sx={{ color: "#00897B" }} />}
                    onClick={onOpenBonus}
                    sx={{
                        justifyContent: "flex-start",
                        textTransform: "none",
                        fontWeight: 600,
                        py: 1,
                        borderRadius: 2,
                        borderColor: "divider",
                        "&:hover": { bgcolor: (t) => alpha(t.palette.text.primary, 0.04) },
                    }}
                >
                    Tambah Bonus Storage
                </Button>

                {/* Ubah Email */}
                <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<MailOutlineRoundedIcon sx={{ color: "info.main" }} />}
                    onClick={onOpenChangeEmail}
                    sx={{
                        justifyContent: "flex-start",
                        textTransform: "none",
                        fontWeight: 600,
                        py: 1,
                        borderRadius: 2,
                        borderColor: "divider",
                        "&:hover": { bgcolor: (t) => alpha(t.palette.text.primary, 0.04) },
                    }}
                >
                    Ubah Alamat Email
                </Button>

                {/* Suspend / Unsuspend */}
                {isSuspended ? (
                    <Button
                        fullWidth
                        variant="outlined"
                        disabled={isUnsuspending}
                        startIcon={
                            isUnsuspending ? (
                                <CircularProgress size={18} color="inherit" />
                            ) : (
                                <CheckCircleOutlineRoundedIcon sx={{ color: "#2E7D32" }} />
                            )
                        }
                        onClick={onUnsuspend}
                        sx={{
                            justifyContent: "flex-start",
                            textTransform: "none",
                            fontWeight: 600,
                            py: 1,
                            borderRadius: 2,
                            color: "#2E7D32",
                            borderColor: alpha("#2E7D32", 0.5),
                            "&:hover": { borderColor: "#2E7D32", bgcolor: alpha("#2E7D32", 0.04) },
                        }}
                    >
                        Pulihkan Akun (Unsuspend)
                    </Button>
                ) : (
                    <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<BlockRoundedIcon sx={{ color: "#E65100" }} />}
                        onClick={onOpenSuspend}
                        sx={{
                            justifyContent: "flex-start",
                            textTransform: "none",
                            fontWeight: 600,
                            py: 1,
                            borderRadius: 2,
                            color: "#E65100",
                            borderColor: alpha("#E65100", 0.5),
                            "&:hover": { borderColor: "#E65100", bgcolor: alpha("#E65100", 0.04) },
                        }}
                    >
                        Tangguhkan Akun (Suspend)
                    </Button>
                )}

                {/* Hapus Akun */}
                <Button
                    fullWidth
                    variant="outlined"
                    color="critical"
                    startIcon={<DeleteOutlineRoundedIcon />}
                    onClick={onTriggerDelete}
                    sx={{
                        justifyContent: "flex-start",
                        textTransform: "none",
                        fontWeight: 600,
                        py: 1,
                        borderRadius: 2,
                    }}
                >
                    Hapus Akun Permanen
                </Button>
            </Stack>
        </Paper>
    );
};
