import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Box,
    Chip,
    MenuItem,
    Alert,
    CircularProgress,
    Stack,
} from "@mui/material";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import { adminClient } from "@/services/adminClient";
import type { UserSubscription } from "@/types/admin";

const BYTES_IN_GB = 1024 * 1024 * 1024;
const BYTES_IN_TB = BYTES_IN_GB * 1024;
const MICROSECONDS_PER_MS = 1000;
const DEFAULT_PRESET_GB = 50;
const UNCAPPED_STORAGE_TB = 100;
const UNCAPPED_EXPIRY_DATE = "2038-01-01";

interface QuotaPreset {
    label: string;
    amount: number;
    unit: "GB" | "TB";
    isUncapped?: boolean;
}

const PRESETS: QuotaPreset[] = [
    { label: "50 GB", amount: 50, unit: "GB" },
    { label: "100 GB", amount: 100, unit: "GB" },
    { label: "1 TB", amount: 1, unit: "TB" },
    { label: "100 TB Uncapped", amount: UNCAPPED_STORAGE_TB, unit: "TB", isUncapped: true },
];

function getFutureDateString(monthsAhead: number): string {
    const target = new Date();
    target.setMonth(target.getMonth() + monthsAhead);
    return target.toISOString().slice(0, 10);
}

export interface QuotaModalProps {
    open: boolean;
    user: { id: number; email: string } | null;
    currentSubscription?: UserSubscription | null;
    onClose: () => void;
    onSuccess?: () => void;
}

export const QuotaModal: React.FC<QuotaModalProps> = ({
    open,
    user,
    currentSubscription,
    onClose,
    onSuccess,
}) => {
    const [amount, setAmount] = useState<number>(DEFAULT_PRESET_GB);
    const [unit, setUnit] = useState<"GB" | "TB">("GB");
    const [expiryDate, setExpiryDate] = useState<string>(() => getFutureDateString(12));
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }
        setErrorMessage(null);
        if (currentSubscription && currentSubscription.storage > 0) {
            const isTB = currentSubscription.storage >= BYTES_IN_TB;
            setUnit(isTB ? "TB" : "GB");
            setAmount(
                isTB
                    ? Math.round(currentSubscription.storage / BYTES_IN_TB)
                    : Math.round(currentSubscription.storage / BYTES_IN_GB)
            );
            if (currentSubscription.expiryTime > 0) {
                const dateObj = new Date(currentSubscription.expiryTime / MICROSECONDS_PER_MS);
                setExpiryDate(dateObj.toISOString().slice(0, 10));
                return;
            }
        }
        setAmount(DEFAULT_PRESET_GB);
        setUnit("GB");
        setExpiryDate(getFutureDateString(12));
    }, [open, currentSubscription]);

    const handleSelectPreset = (preset: QuotaPreset) => {
        setAmount(preset.amount);
        setUnit(preset.unit);
        if (preset.isUncapped) {
            setExpiryDate(UNCAPPED_EXPIRY_DATE);
        }
    };

    const handleSave = async () => {
        if (!user) {
            return;
        }
        if (amount <= 0 || Number.isNaN(amount)) {
            setErrorMessage("Kapasitas kuota harus berupa angka lebih dari 0");
            return;
        }
        const selectedTimestamp = new Date(expiryDate).getTime();
        if (Number.isNaN(selectedTimestamp)) {
            setErrorMessage("Format tanggal kedaluwarsa tidak valid");
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);
        try {
            const bytesMultiplier = unit === "TB" ? BYTES_IN_TB : BYTES_IN_GB;
            const storageInBytes = amount * bytesMultiplier;
            const expiryTimeInMicro = selectedTimestamp * MICROSECONDS_PER_MS;

            await adminClient.updateSubscription({
                userID: user.id,
                storageInBytes,
                expiryTimeInMicro,
            });
            onSuccess?.();
            onClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Gagal memperbarui kuota langganan";
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={isLoading ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 38,
                            height: 38,
                            borderRadius: "50%",
                            bgcolor: "rgba(200, 80, 46, 0.12)",
                            color: "#C8502E",
                        }}
                    >
                        <StorageRoundedIcon />
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                            Ubah Kuota Penyimpanan
                        </Typography>
                        <Typography variant="small" sx={{ color: "text.muted" }}>
                            {user?.email}
                        </Typography>
                    </Box>
                </Box>
            </DialogTitle>

            <DialogContent dividers sx={{ py: 2.5 }}>
                {errorMessage && (
                    <Alert severity="error" sx={{ mb: 2.5 }}>
                        {errorMessage}
                    </Alert>
                )}

                <Typography variant="body" sx={{ fontWeight: 600, mb: 1, display: "block" }}>
                    Preset Cepat:
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: "wrap", gap: 1 }}>
                    {PRESETS.map((preset) => {
                        const isSelected = amount === preset.amount && unit === preset.unit;
                        return (
                            <Chip
                                key={preset.label}
                                label={preset.label}
                                clickable
                                color={isSelected ? "primary" : "default"}
                                variant={isSelected ? "filled" : "outlined"}
                                onClick={() => handleSelectPreset(preset)}
                                sx={{
                                    fontWeight: 600,
                                    ...(isSelected && {
                                        bgcolor: "rgba(200, 80, 46, 0.12)",
                                        color: "#C8502E",
                                        borderColor: "#C8502E",
                                    }),
                                }}
                            />
                        );
                    })}
                </Stack>

                <Typography variant="body" sx={{ fontWeight: 600, mb: 1, display: "block" }}>
                    Kapasitas Kustom:
                </Typography>
                <Box sx={{ display: "flex", gap: 1.5, mb: 3 }}>
                    <TextField
                        type="number"
                        label="Ukuran Kuota"
                        size="small"
                        fullWidth
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        disabled={isLoading}
                        slotProps={{ htmlInput: { min: 1 } }}
                    />
                    <TextField
                        select
                        size="small"
                        label="Satuan"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value as "GB" | "TB")}
                        disabled={isLoading}
                        sx={{ minWidth: 100 }}
                    >
                        <MenuItem value="GB">GB</MenuItem>
                        <MenuItem value="TB">TB</MenuItem>
                    </TextField>
                </Box>

                <Typography variant="body" sx={{ fontWeight: 600, mb: 1, display: "block" }}>
                    Kedaluwarsa Langganan:
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap", gap: 1 }}>
                    <Chip
                        size="small"
                        label="+1 Bulan"
                        onClick={() => setExpiryDate(getFutureDateString(1))}
                        clickable
                    />
                    <Chip
                        size="small"
                        label="+1 Tahun"
                        onClick={() => setExpiryDate(getFutureDateString(12))}
                        clickable
                    />
                    <Chip
                        size="small"
                        label="Tanpa Batas (2038)"
                        onClick={() => setExpiryDate(UNCAPPED_EXPIRY_DATE)}
                        clickable
                    />
                </Stack>
                <TextField
                    type="date"
                    size="small"
                    fullWidth
                    label="Pilih Tanggal"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    disabled={isLoading}
                    slotProps={{
                        inputLabel: { shrink: true },
                        input: {
                            startAdornment: (
                                <EventRoundedIcon fontSize="small" sx={{ mr: 1, color: "text.muted" }} />
                            ),
                        },
                    }}
                />
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={isLoading} color="inherit">
                    Batal
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={isLoading}
                    variant="contained"
                    color="accent"
                    sx={{ minWidth: 120, fontWeight: 600 }}
                >
                    {isLoading ? <CircularProgress size={20} color="inherit" /> : "Simpan Kuota"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
