// Biyen Photos — About & AGPLv3 Compliance Dialog
// Copyright 2026 Levitation — AGPL-3.0-or-later

import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Stack,
    Typography,
} from "@mui/material";
import { BIYEN_BRAND } from "ente-base/biyen-config";
import { BiyenLogo } from "ente-base/components/EnteLogo";
import React from "react";
import { useTranslation } from "react-i18next";

interface BiyenAboutDialogProps {
    open: boolean;
    onClose: () => void;
}

export const BiyenAboutDialog: React.FC<BiyenAboutDialogProps> = ({
    open,
    onClose,
}) => {
    const { i18n } = useTranslation();
    const isId = i18n.language.startsWith("id");

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            sx={{
                "& .MuiDialog-paper": {
                    borderRadius: "16px",
                    p: 1,
                    bgcolor: "background.paper",
                },
            }}
        >
            <DialogTitle sx={{ textAlign: "center", pt: 3, pb: 1 }}>
                <Box sx={{ mb: 1.5, display: "flex", justifyContent: "center" }}>
                    <BiyenLogo height={32} />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "'Outfit Variable', sans-serif" }}>
                    {BIYEN_BRAND.name}
                </Typography>
                <Typography variant="small" sx={{ color: "text.muted", display: "block", mt: 0.5 }}>
                    {isId ? "Dikembangkan oleh Levitation" : "Developed by Levitation"}
                </Typography>
            </DialogTitle>

            <DialogContent dividers sx={{ py: 2.5, px: 3 }}>
                <Stack spacing={2}>
                    <Box
                        sx={{
                            p: 2,
                            borderRadius: "12px",
                            bgcolor: "background.default",
                            border: "1px solid",
                            borderColor: "divider",
                        }}
                    >
                        <Typography variant="small" sx={{ fontWeight: 600, mb: 0.5, display: "block" }}>
                            {isId ? "Lisensi & Kepatuhan Sumber Terbuka (AGPLv3)" : "Open Source & AGPLv3 Compliance"}
                        </Typography>
                        <Typography variant="small" sx={{ color: "text.muted", fontSize: "0.85rem", lineHeight: 1.6, display: "block" }}>
                            {isId
                                ? "Biyen Photos adalah proyek independen berbasis fork dari Ente Photos yang dilisensikan di bawah GNU Affero General Public License v3 (AGPLv3)."
                                : "Biyen Photos is an independent fork of Ente Photos licensed under the GNU Affero General Public License v3 (AGPLv3)."}
                        </Typography>
                        <Typography variant="small" sx={{ color: "text.muted", fontSize: "0.85rem", lineHeight: 1.6, mt: 1, display: "block" }}>
                            {isId
                                ? "Ditenagai oleh arsitektur open-source Ente Technologies, Inc. dengan kriptografi E2EE yang diaudit independen oleh Cure53 dan Kudelski Security."
                                : "Powered by the open-source architecture of Ente Technologies, Inc. featuring E2EE cryptography independently audited by Cure53 and Kudelski Security."}
                        </Typography>
                        <Typography variant="mini" sx={{ mt: 1.5, fontStyle: "italic", color: "text.faint", display: "block" }}>
                            {isId
                                ? "Aplikasi ini tidak berafiliasi, disponsori, atau didukung secara resmi oleh Ente Technologies, Inc."
                                : "Not affiliated with, sponsored, or endorsed by Ente Technologies, Inc."}
                        </Typography>
                    </Box>

                    <Stack spacing={1}>
                        <Typography variant="small" sx={{ fontWeight: 600 }}>
                            {isId ? "Tautan Resmi" : "Official Links"}
                        </Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                                variant="outlined"
                                size="small"
                                href={BIYEN_BRAND.repoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ textTransform: "none", borderRadius: "8px" }}
                            >
                                {isId ? "Kode Sumber (AGPL §13)" : "Source Code (AGPL §13)"}
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                href={BIYEN_BRAND.privacyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ textTransform: "none", borderRadius: "8px" }}
                            >
                                {isId ? "Kebijakan Privasi" : "Privacy Policy"}
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                href={BIYEN_BRAND.termsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ textTransform: "none", borderRadius: "8px" }}
                            >
                                {isId ? "Ketentuan Layanan" : "Terms of Service"}
                            </Button>
                        </Stack>
                    </Stack>

                    <Divider />

                    <Typography variant="mini" sx={{ textAlign: "center", display: "block", color: "text.faint" }}>
                        Copyright &copy; Ente Technologies, Inc. &bull; Modifications &copy; 2026 Levitation
                    </Typography>
                </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} variant="contained" color="primary" sx={{ textTransform: "none", borderRadius: "8px" }}>
                    {isId ? "Tutup" : "Close"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
