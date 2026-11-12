import React, { useState } from "react";
import Link from "next/link";
import {
    Box,
    Breadcrumbs,
    Typography,
    Chip,
    Tooltip,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    alpha,
} from "@mui/material";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import {
    Image01Icon,
    Key01Icon,
    Logout01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { NavbarBase } from "ente-base/components/Navbar";
import { EnteLogo, EnteLogoBox } from "ente-base/components/EnteLogo";
import { FocusVisibleButton } from "ente-base/components/mui/FocusVisibleButton";
import { SudoFreshnessBar } from "./SudoFreshnessBar";
import { authStore } from "@/services/authStore";
import { getAdminEndpoint } from "@/services/adminClient";

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

export interface AdminHeaderProps {
    title?: string;
    breadcrumbs?: BreadcrumbItem[];
    serverEndpoint?: string;
    onLogout?: () => void;
    onOpenSudoModal?: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
    title,
    breadcrumbs,
    serverEndpoint,
    onLogout,
    onOpenSudoModal,
}) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const menuOpen = Boolean(anchorEl);

    const activeEndpoint = serverEndpoint || getAdminEndpoint();
    const cleanEndpointDisplay = activeEndpoint.replace(/^https?:\/\//, "");

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleChangeToken = () => {
        handleMenuClose();
        if (onOpenSudoModal) {
            onOpenSudoModal();
            return;
        }
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("biyen:admin:open-sudo-modal"));
        }
    };

    const handleLogoutAction = () => {
        handleMenuClose();
        if (onLogout) {
            onLogout();
            return;
        }
        authStore.clearToken();
    };

    return (
        <NavbarBase
            sx={{
                flex: { xs: "0 0 58px", sm: "0 0 64px" },
                height: { xs: 58, sm: 64 },
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: { xs: 1.5, sm: 2.5 },
                borderBottom: "1px solid",
                borderColor: "divider",
                bgcolor: "background.default",
                zIndex: 100,
            }}
        >
            {/* Left: Logo, Admin Chip, and Breadcrumbs */}
            <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                <Link
                    href="/"
                    style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                >
                    <EnteLogoBox
                        sx={{
                            "& svg": { height: { xs: "22px", sm: "24px" } },
                            display: "inline-flex",
                            alignItems: "center",
                        }}
                    >
                        <EnteLogo height={24} />
                    </EnteLogoBox>
                </Link>

                <Chip
                    label="Admin"
                    size="small"
                    sx={{
                        ml: 1.25,
                        height: 22,
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        fontFamily: '"Outfit Variable", Outfit, sans-serif',
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        bgcolor: (theme) => alpha(theme.palette.accent?.main ?? "#C8502E", 0.12),
                        color: "accent.main",
                        border: "1px solid",
                        borderColor: (theme) => alpha(theme.palette.accent?.main ?? "#C8502E", 0.28),
                        borderRadius: "6px",
                    }}
                />

                <Box
                    sx={{
                        display: { xs: "none", md: "block" },
                        width: "1px",
                        height: 20,
                        bgcolor: "divider",
                        mx: 2,
                    }}
                />

                {/* Page Title & Breadcrumbs */}
                <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}>
                    {breadcrumbs && breadcrumbs.length > 0 ? (
                        <Breadcrumbs
                            separator={<NavigateNextRoundedIcon sx={{ fontSize: 16, color: "text.faint" }} />}
                            aria-label="breadcrumb"
                        >
                            {breadcrumbs.map((item, idx) => {
                                const isLast = idx === breadcrumbs.length - 1;
                                if (isLast) {
                                    return (
                                        <Typography
                                            key={item.label}
                                            sx={{
                                                fontFamily: '"Outfit Variable", Outfit, sans-serif',
                                                fontWeight: 600,
                                                fontSize: "0.9375rem",
                                                color: "text.base",
                                            }}
                                        >
                                            {item.label}
                                        </Typography>
                                    );
                                }
                                return (
                                    <Link
                                        key={item.label}
                                        href={item.href || "#"}
                                        style={{ textDecoration: "none", color: "inherit" }}
                                    >
                                        <Typography
                                            sx={{
                                                fontFamily: '"Inter Variable", Inter, sans-serif',
                                                fontSize: "0.875rem",
                                                color: "text.muted",
                                                "&:hover": { color: "text.base" },
                                            }}
                                        >
                                            {item.label}
                                        </Typography>
                                    </Link>
                                );
                            })}
                        </Breadcrumbs>
                    ) : (
                        <Typography
                            sx={{
                                fontFamily: '"Outfit Variable", Outfit, sans-serif',
                                fontWeight: 600,
                                fontSize: "1rem",
                                color: "text.base",
                            }}
                        >
                            {title || "Dashboard"}
                        </Typography>
                    )}
                </Box>
            </Box>

            {/* Right: Sudo Freshness, Server Endpoint, Link to Photos, and Menu */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <SudoFreshnessBar onOpenModal={handleChangeToken} />

                <Chip
                    icon={<DnsRoundedIcon sx={{ fontSize: 14 }} />}
                    label={cleanEndpointDisplay}
                    size="small"
                    variant="outlined"
                    sx={{
                        display: { xs: "none", lg: "inline-flex" },
                        height: 28,
                        fontSize: "0.75rem",
                        fontFamily: '"Inter Variable", Inter, sans-serif',
                        fontWeight: 500,
                        borderColor: "divider",
                        color: "text.muted",
                    }}
                />

                {/* Return to Photos Web App Button */}
                <Tooltip title="Buka Galeri Foto Biyen (Tab Baru)">
                    <FocusVisibleButton
                        color="secondary"
                        onClick={() => {
                            if (typeof window !== "undefined") {
                                window.open("https://app-biyen.levitation.web.id", "_blank", "noopener,noreferrer");
                            }
                        }}
                        sx={{
                            minWidth: 0,
                            height: 36,
                            px: 1.25,
                            borderRadius: "10px",
                            display: { xs: "none", sm: "inline-flex" },
                            alignItems: "center",
                            gap: 0.75,
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            fontFamily: '"Inter Variable", Inter, sans-serif',
                            color: "text.base",
                            border: "1px solid",
                            borderColor: "divider",
                        }}
                    >
                        <HugeiconsIcon icon={Image01Icon} size={16} strokeWidth={1.8} />
                        <span>Galeri Foto</span>
                        <OpenInNewRoundedIcon sx={{ fontSize: 14, color: "text.muted" }} />
                    </FocusVisibleButton>
                </Tooltip>

                {/* More / Settings Menu */}
                <Tooltip title="Menu Opsi">
                    <FocusVisibleButton
                        color="secondary"
                        aria-label="Menu Opsi Admin"
                        onClick={handleMenuOpen}
                        sx={{
                            minWidth: 0,
                            width: 36,
                            height: 36,
                            p: 0,
                            borderRadius: "10px",
                            color: "text.base",
                        }}
                    >
                        <MoreVertRoundedIcon sx={{ fontSize: 20 }} />
                    </FocusVisibleButton>
                </Tooltip>

                <Menu
                    anchorEl={anchorEl}
                    open={menuOpen}
                    onClose={handleMenuClose}
                    transformOrigin={{ horizontal: "right", vertical: "top" }}
                    anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
                    slotProps={{
                        paper: {
                            sx: {
                                mt: 1,
                                minWidth: 200,
                                borderRadius: "12px",
                                border: "1px solid",
                                borderColor: "divider",
                                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                            },
                        },
                    }}
                >
                    <MenuItem onClick={handleChangeToken}>
                        <ListItemIcon>
                            <HugeiconsIcon icon={Key01Icon} size={18} strokeWidth={1.8} />
                        </ListItemIcon>
                        <ListItemText
                            primary={
                                <Typography sx={{ fontSize: "0.875rem", fontFamily: '"Inter Variable", Inter, sans-serif' }}>
                                    Ubah Token Sudo
                                </Typography>
                            }
                        />
                    </MenuItem>
                    <MenuItem onClick={handleLogoutAction} sx={{ color: "error.main" }}>
                        <ListItemIcon sx={{ color: "error.main" }}>
                            <HugeiconsIcon icon={Logout01Icon} size={18} strokeWidth={1.8} />
                        </ListItemIcon>
                        <ListItemText
                            primary={
                                <Typography sx={{ fontSize: "0.875rem", fontFamily: '"Inter Variable", Inter, sans-serif', color: "inherit" }}>
                                    Keluar
                                </Typography>
                            }
                        />
                    </MenuItem>
                </Menu>
            </Box>
        </NavbarBase>
    );
};
