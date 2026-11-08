import CloseIcon from "@mui/icons-material/Close";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
} from "@mui/material";
import type { PublicAlbumsCredentials } from "ente-base/http";
import React, { useState } from "react";
import { submitPublicAbuseReport } from "../data/api/public-collection";

export interface ReportAbuseModalProps {
    open: boolean;
    onClose: () => void;
    credentials: PublicAlbumsCredentials;
}

const reasons: string[] = [
    "Pelanggaran Hak Cipta (Copyright / DMCA)",
    "Konten Ilegal atau Asusila",
    "Pelecehan atau Pelanggaran Privasi",
    "Spam atau Perangkat Berbahaya",
    "Lainnya",
];

export const ReportAbuseModal: React.FC<ReportAbuseModalProps> = ({
    open,
    onClose,
    credentials,
}) => {
    const [reason, setReason] = useState<string>(reasons[0] ?? "Lainnya");
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim() || !email.trim()) {
            setErrorMsg("Nama dan email pelapor wajib diisi.");
            return;
        }

        setSubmitting(true);
        setErrorMsg(null);

        try {
            await submitPublicAbuseReport(credentials, {
                url: window.location.href,
                reason,
                fullName: fullName.trim(),
                email: email.trim(),
                comment: comment.trim(),
            });
            setSuccess(true);
        } catch (err: unknown) {
            const message =
                err instanceof Error && err.message.includes("429")
                    ? "Batas frekuensi laporan tercapai. Silakan coba kembali beberapa saat lagi."
                    : "Terjadi kesalahan saat mengirim laporan. Silakan coba lagi nanti.";
            setErrorMsg(message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!submitting) {
            setErrorMsg(null);
            setSuccess(false);
            onClose();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        borderRadius: "16px",
                        p: 3,
                        bgcolor: "background.paper",
                        color: "text.primary",
                    },
                },
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                }}
            >
                <Typography sx={{ fontWeight: 600, fontSize: "1.25rem" }}>
                    Laporkan Penyalahgunaan Konten
                </Typography>
                <IconButton onClick={handleClose} size="small" disabled={submitting}>
                    <CloseIcon />
                </IconButton>
            </Box>

            {success ? (
                <Box sx={{ py: 3, textAlign: "center" }}>
                    <Alert severity="success" sx={{ mb: 3, borderRadius: "8px" }}>
                        Laporan Anda telah berhasil dicatat. Tim kepatuhan kami akan segera meninjau tautan ini dan mengambil tindakan yang diperlukan.
                    </Alert>
                    <Button
                        variant="contained"
                        onClick={handleClose}
                        sx={{ textTransform: "none", borderRadius: "8px", px: 4 }}
                    >
                        Tutup
                    </Button>
                </Box>
            ) : (
                <form onSubmit={handleSubmit}>
                    <Typography
                        sx={{ color: "text.secondary", mb: 3, fontSize: "0.875rem" }}
                    >
                        Jika Anda mendapati tautan publik ini memuat materi yang melanggar hak cipta, hukum, atau privasi Anda, silakan isi formulir di bawah ini.
                    </Typography>

                    {errorMsg && (
                        <Alert severity="error" sx={{ mb: 2, borderRadius: "8px" }}>
                            {errorMsg}
                        </Alert>
                    )}

                    <FormControl fullWidth sx={{ mb: 2 }} size="small">
                        <InputLabel id="abuse-reason-label">Alasan Pelaporan</InputLabel>
                        <Select
                            labelId="abuse-reason-label"
                            value={reason}
                            label="Alasan Pelaporan"
                            onChange={(e) => setReason(String(e.target.value))}
                        >
                            {reasons.map((r) => (
                                <MenuItem key={r} value={r}>
                                    {r}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        fullWidth
                        size="small"
                        label="Nama Lengkap"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        fullWidth
                        size="small"
                        type="email"
                        label="Alamat Email Pelapor"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        helperText="Kami memerlukan email untuk verifikasi atau tindak lanjut laporan."
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        fullWidth
                        size="small"
                        multiline
                        rows={3}
                        label="Keterangan Tambahan (Opsional)"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Jelaskan secara singkat foto atau file mana yang dimaksud..."
                        sx={{ mb: 3 }}
                    />

                    <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
                        <Button
                            variant="outlined"
                            onClick={handleClose}
                            disabled={submitting}
                            sx={{ textTransform: "none", borderRadius: "8px" }}
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={submitting}
                            sx={{
                                textTransform: "none",
                                borderRadius: "8px",
                                px: 3,
                                bgcolor: "#d32f2f",
                                color: "#ffffff",
                                "&:hover": { bgcolor: "#b71c1c" },
                            }}
                        >
                            {submitting ? (
                                <CircularProgress size={20} color="inherit" />
                            ) : (
                                "Kirim Laporan"
                            )}
                        </Button>
                    </Box>
                </form>
            )}
        </Dialog>
    );
};
