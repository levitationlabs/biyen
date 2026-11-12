import React from "react";
import { Box, Typography } from "@mui/material";

import { AdminLayout } from "@/components/layout/AdminLayout";
import {
    UsageRecalculationPanel,
    QueueRequeuePanel,
    SystemMailerPanel,
} from "@/components/system";

const SystemOperationsPage: React.FC = () => {
    return (
        <AdminLayout
            title="Pemeliharaan & Operasi Sistem"
            breadcrumbs={[
                { label: "Biyen Admin", href: "/" },
                { label: "Pemeliharaan Sistem" },
            ]}
        >
            {/* Header Title & Subtitle */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Pemeliharaan & Operasi Sistem
                </Typography>
                <Typography variant="body" sx={{ color: "text.muted" }}>
                    Kelola sinkronisasi kuota penyimpanan pengguna, pemulihan antrean background worker, dan diagnostik transmisi email server.
                </Typography>
            </Box>

            {/* 3 Main Operations Panels Grid */}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        md: "1fr 1fr",
                        lg: "repeat(3, 1fr)",
                    },
                    gap: 3,
                    alignItems: "stretch",
                }}
            >
                {/* 1. Usage Recalculation */}
                <UsageRecalculationPanel />

                {/* 2. Job Queue Re-queue */}
                <QueueRequeuePanel />

                {/* 3. System Mailer Test */}
                <SystemMailerPanel />
            </Box>
        </AdminLayout>
    );
};

export default SystemOperationsPage;
