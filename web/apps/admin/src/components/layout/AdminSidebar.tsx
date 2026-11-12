import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
    Box,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    Divider,
    Chip,
    alpha,
} from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import PhotoLibraryRoundedIcon from "@mui/icons-material/PhotoLibraryRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { EnteLogo } from "ente-base/components/EnteLogo";
import { BIYEN_BRAND } from "ente-base/biyen-config";

export interface NavigationItem {
    label: string;
    href: string;
    icon: React.ReactElement;
}

export const ADMIN_NAV_ITEMS: NavigationItem[] = [
    {
        label: "Dashboard",
        href: "/",
        icon: <DashboardRoundedIcon fontSize="small" />,
    },
    {
        label: "Pengguna & Kuota",
        href: "/users",
        icon: <PeopleAltRoundedIcon fontSize="small" />,
    },
    {
        label: "Abuse Center",
        href: "/abuse",
        icon: <ShieldRoundedIcon fontSize="small" />,
    },
    {
        label: "Pemeliharaan Sistem",
        href: "/system",
        icon: <SettingsRoundedIcon fontSize="small" />,
    },
];

export const TERRACOTTA_PRIMARY = "#C8502E";

export interface AdminSidebarProps {
    onNavigate?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ onNavigate }) => {
    const router = useRouter();
    const currentPath = router.pathname;

    const isItemActive = (itemHref: string) => {
        if (itemHref === "/") {
            return currentPath === "/";
        }
        return currentPath.startsWith(itemHref);
    };

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                bgcolor: (theme) =>
                    theme.palette.mode === "dark" ? "#241D19" : "#FFFFFF",
            }}
        >
            {/* Header Brand Logo */}
            <Box sx={{ p: 2.5, pb: 2 }}>
                <Link
                    href="/"
                    style={{ textDecoration: "none", color: "inherit" }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.25,
                        }}
                    >
                        <EnteLogo height={24} />
                        <Chip
                            label="Admin"
                            size="small"
                            sx={{
                                height: 20,
                                fontSize: "0.65rem",
                                fontWeight: 700,
                                fontFamily: '"Outfit Variable", Outfit, sans-serif',
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                bgcolor: alpha(TERRACOTTA_PRIMARY, 0.12),
                                color: TERRACOTTA_PRIMARY,
                                border: "1px solid",
                                borderColor: alpha(TERRACOTTA_PRIMARY, 0.3),
                            }}
                        />
                    </Box>
                </Link>
                <Typography
                    variant="small"
                    sx={{
                        color: "text.muted",
                        mt: 0.5,
                        display: "block",
                    }}
                >
                    Pusat Manajemen Foto & Arsip
                </Typography>
            </Box>

            <Divider sx={{ mx: 2 }} />

            {/* Navigation Menu */}
            <Box sx={{ flex: 1, py: 1.5, px: 1.5 }}>
                <List disablePadding>
                    {ADMIN_NAV_ITEMS.map((item) => {
                        const active = isItemActive(item.href);

                        return (
                            <ListItem key={item.href} disablePadding sx={{ mb: 0.5 }}>
                                <Link
                                    href={item.href}
                                    passHref
                                    legacyBehavior
                                    style={{ width: "100%", textDecoration: "none" }}
                                >
                                    <ListItemButton
                                        onClick={onNavigate}
                                        selected={active}
                                        sx={{
                                            borderRadius: 2,
                                            py: 1,
                                            px: 1.5,
                                            transition: "all 0.15s ease",
                                            "&.Mui-selected": {
                                                bgcolor: alpha(TERRACOTTA_PRIMARY, 0.1),
                                                color: TERRACOTTA_PRIMARY,
                                                fontWeight: 600,
                                                "&:hover": {
                                                    bgcolor: alpha(TERRACOTTA_PRIMARY, 0.16),
                                                },
                                                "& .MuiListItemIcon-root": {
                                                    color: TERRACOTTA_PRIMARY,
                                                },
                                            },
                                            "&:hover": {
                                                bgcolor: (theme) =>
                                                    theme.palette.mode === "dark"
                                                        ? "rgba(255, 255, 255, 0.05)"
                                                        : "rgba(0, 0, 0, 0.04)",
                                            },
                                        }}
                                    >
                                        <ListItemIcon
                                            sx={{
                                                minWidth: 34,
                                                color: active
                                                    ? TERRACOTTA_PRIMARY
                                                    : "text.muted",
                                            }}
                                        >
                                            {item.icon}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={
                                                <Typography
                                                    variant="body"
                                                    sx={{
                                                        fontSize: "0.875rem",
                                                        fontWeight: active ? 700 : 500,
                                                        color: active
                                                            ? TERRACOTTA_PRIMARY
                                                            : "text.base",
                                                    }}
                                                >
                                                    {item.label}
                                                </Typography>
                                            }
                                        />
                                    </ListItemButton>
                                </Link>
                            </ListItem>
                        );
                    })}
                </List>
            </Box>

            <Divider sx={{ mx: 2 }} />

            {/* Bottom Gallery Link */}
            <Box sx={{ p: 1.5 }}>
                <ListItemButton
                    component="a"
                    href={BIYEN_BRAND.photosUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                        borderRadius: 2,
                        py: 1,
                        px: 1.5,
                        color: "text.muted",
                        border: "1px dashed",
                        borderColor: "divider",
                        "&:hover": {
                            bgcolor: alpha(TERRACOTTA_PRIMARY, 0.06),
                            color: TERRACOTTA_PRIMARY,
                            borderColor: alpha(TERRACOTTA_PRIMARY, 0.3),
                            "& .MuiListItemIcon-root": {
                                color: TERRACOTTA_PRIMARY,
                            },
                        },
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
                        <PhotoLibraryRoundedIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                        primary={
                            <Typography
                                variant="small"
                                sx={{ fontWeight: 500 }}
                            >
                                Kembali ke Galeri Foto
                            </Typography>
                        }
                    />
                    <OpenInNewRoundedIcon sx={{ fontSize: 14, ml: 0.5, opacity: 0.7 }} />
                </ListItemButton>
            </Box>
        </Box>
    );
};
