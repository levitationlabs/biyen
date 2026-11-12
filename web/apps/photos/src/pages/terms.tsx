// Biyen Photos — Ketentuan Layanan (Terms of Service)
// Copyright 2026 Levitation — AGPL-3.0-or-later

import {
    Box,
    Button,
    Container,
    Divider,
    Paper,
    Stack,
    Typography,
} from "@mui/material";
import { BiyenLogo } from "ente-base/components/EnteLogo";
import { CustomHeadPhotos } from "ente-base/components/Head";
import Link from "next/link";
import React from "react";

export default function TermsPage(): React.JSX.Element {
    return (
        <>
            <CustomHeadPhotos title="Ketentuan Layanan — Biyen Photos" />
            <Box
                sx={{
                    minHeight: "100vh",
                    bgcolor: "background.default",
                    py: { xs: 4, sm: 8 },
                    px: 2,
                }}
            >
                <Container maxWidth="md">
                    <Stack spacing={4}>
                        <Stack
                            direction="row"
                            sx={{
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}
                        >
                            <Link href="/" style={{ textDecoration: "none" }}>
                                <BiyenLogo height={26} />
                            </Link>
                            <Button
                                component={Link}
                                href="/"
                                variant="text"
                                color="inherit"
                                size="small"
                                sx={{ textTransform: "none" }}
                            >
                                &larr; Kembali ke Galeri
                            </Button>
                        </Stack>

                        <Paper
                            elevation={0}
                            sx={{
                                p: { xs: 3, sm: 5 },
                                borderRadius: "16px",
                                border: "1px solid",
                                borderColor: "divider",
                                bgcolor: "background.paper",
                            }}
                        >
                            <Typography
                                variant="h4"
                                component="h1"
                                sx={{
                                    fontFamily: "'Outfit Variable', sans-serif",
                                    fontWeight: 800,
                                    letterSpacing: "-0.02em",
                                    mb: 1,
                                    color: "text.primary",
                                }}
                            >
                                Ketentuan Layanan Biyen Photos
                            </Typography>
                            <Typography
                                variant="small"
                                sx={{ color: "text.muted", display: "block", mb: 4 }}
                            >
                                Terakhir diperbarui: 12 November 2026 &bull; Dikelola oleh Levitation
                            </Typography>

                            <Stack spacing={3} sx={{ color: "text.primary", lineHeight: 1.7 }}>
                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                        1. Penerimaan Ketentuan
                                    </Typography>
                                    <Typography variant="body" sx={{ color: "text.muted", display: "block" }}>
                                        Dengan membuat akun atau menggunakan layanan Biyen Photos, Anda menyetujui untuk terikat oleh Ketentuan Layanan ini. Jika Anda tidak menyetujui ketentuan ini, Anda tidak diperkenankan menggunakan layanan kami.
                                    </Typography>
                                </Box>

                                <Divider />

                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                        2. Tanggung Jawab Kunci Enkripsi
                                    </Typography>
                                    <Typography variant="body" sx={{ color: "text.muted", display: "block" }}>
                                        Biyen Photos menggunakan enkripsi end-to-end tanpa pintu belakang (zero-knowledge). Kata sandi dan kunci pemulihan (recovery key) Anda dipegang sepenuhnya oleh Anda. Jika Anda kehilangan kata sandi dan kunci pemulihan, data Anda tidak dapat dipulihkan oleh pihak manapun termasuk tim Biyen.
                                    </Typography>
                                </Box>

                                <Divider />

                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                        3. Penggunaan yang Dilarang
                                    </Typography>
                                    <Typography variant="body" sx={{ color: "text.muted", display: "block" }}>
                                        Anda dilarang menggunakan Biyen Photos untuk menyimpan atau mendistribusikan materi ilegal, materi eksploitasi seksual anak (CSAM), malware, atau melakukan tindakan yang mengganggu integritas infrastruktur sistem. Pelanggaran akan mengakibatkan pemutusan akun seketika.
                                    </Typography>
                                </Box>

                                <Divider />

                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                        4. Lisensi Perangkat Lunak
                                    </Typography>
                                    <Typography variant="body" sx={{ color: "text.muted", display: "block" }}>
                                        Biyen Photos adalah perangkat lunak sumber terbuka yang dilisensikan di bawah GNU Affero General Public License v3 (AGPLv3). Anda berhak memeriksa kode sumber lengkap kami di{" "}
                                        <a href="https://github.com/levitationlabs/biyen" target="_blank" rel="noopener noreferrer" style={{ color: "#C8502E" }}>
                                            github.com/levitationlabs/biyen
                                        </a>.
                                    </Typography>
                                </Box>

                                <Divider />

                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                        5. Kontak Bantuan
                                    </Typography>
                                    <Typography variant="body" sx={{ color: "text.muted", display: "block" }}>
                                        Pertanyaan atau laporan mengenai ketentuan layanan dapat dikirimkan ke{" "}
                                        <a href="mailto:halo@biyen.levitation.web.id" style={{ color: "#C8502E" }}>
                                            halo@biyen.levitation.web.id
                                        </a>.
                                    </Typography>
                                </Box>
                            </Stack>
                        </Paper>

                        <Typography variant="mini" sx={{ color: "text.faint", textAlign: "center", display: "block" }}>
                            Biyen Photos &bull; Lisensi GNU AGPLv3 &bull; Ditenagai oleh arsitektur open-source Ente
                        </Typography>
                    </Stack>
                </Container>
            </Box>
        </>
    );
}
