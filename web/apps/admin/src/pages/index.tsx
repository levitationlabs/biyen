import React from "react";
import { Typography, Container, Box } from "@mui/material";

const AdminDashboard: React.FC = () => {
    return (
        <Container maxWidth="lg">
            <Box sx={{ py: 4 }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    Biyen Admin
                </Typography>
            </Box>
        </Container>
    );
};

export default AdminDashboard;
