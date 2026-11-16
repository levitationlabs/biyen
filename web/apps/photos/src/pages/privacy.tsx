// Biyen Photos — Kebijakan Privasi (Privacy Policy)
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

export default function PrivacyPage(): React.JSX.Element {
    return (
        <>
            <CustomHeadPhotos title="Kebijakan Privasi — Biyen Photos" />
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
                                Kebijakan Privasi Biyen Photos
                            </Typography>
                            <Typography
                                variant="small"
                                sx={{ color: "text.muted", display: "block", mb: 4 }}
                            >
                                Terakhir diperbarui: 16 November 2026 &bull; Dikelola oleh Levitation
                            </Typography>

                            <Stack spacing={3} sx={{ color: "text.primary", lineHeight: 1.7 }}>
                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                        1. Enkripsi End-to-End &amp; Dua Mode Kunci Pemulihan
                                    </Typography>
                                    <Typography variant="body" sx={{ color: "text.muted", display: "block" }}>
                                        Biyen Photos selalu mengenkripsi foto, video, dan metadata secara lokal di perangkat Anda (Argon2id + XChaCha20-Poly1305 / AES-256-GCM) sebelum diunggah, sehingga peladen kami tidak pernah bisa membaca konten kenangan Anda. Untuk kunci pemulihan 24-kata, Anda dapat memilih: (a) Mode Terkelola (Blind Vault Post-Quantum HPKE X-Wing MLKEM768-X25519) yang menitipkan salinan terenkripsi ke Admin Custody Key yang kunci privatnya disimpan offline (tidak pernah berada di VPS), agar akun tetap dapat dipulihkan via Biyen Support + Admin offline menggunakan Kode Permintaan 20 karakter; atau (b) Mode Zero-Knowledge Murni tanpa cadangan escrow apa pun.
                                    </Typography>
                                </Box>

                                <Divider />

                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                        2. Informasi yang Kami Kumpulkan
                                    </Typography>
                                    <Typography variant="body" sx={{ color: "text.muted", display: "block" }}>
                                        Kami membatasi pengumpulan data seminimal mungkin untuk pengoperasian layanan:
                                    </Typography>
                                    <Box component="ul" sx={{ pl: 3, color: "text.muted", mt: 1 }}>
                                        <li>Alamat email untuk autentikasi akun, notifikasi keamanan, dan verifikasi sesi.</li>
                                        <li>Blob media dan metadata terenkripsi (ciphertext) yang Anda simpan.</li>
                                        <li>Khusus Mode Terkelola: blob escrow terenkripsi X-Wing (hingga 5 versi terakhir) beserta komitmen SHA-512, tanpa kunci privat pembuka di peladen VPS.</li>
                                        <li>Saat mengajukan pemulihan escrow: kunci publik sementara perangkat, Kode Permintaan 20 karakter, referensi support, dan catatan audit log berantai hash SHA-512.</li>
                                        <li>Metrik performa dasar tanpa pelacak iklan pihak ketiga.</li>
                                    </Box>
                                </Box>

                                <Divider />

                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                        3. Pemrosesan Data & Machine Learning
                                    </Typography>
                                    <Typography variant="body" sx={{ color: "text.muted", display: "block" }}>
                                        Seluruh fitur pencarian cerdas, pengelompokan wajah, dan pengenalan objek diproses secara lokal di perangkat Anda (on-device machine learning). Model pembelajaran mesin tidak pernah mengirimkan data biometrik mentah ke server.
                                    </Typography>
                                </Box>

                                <Divider />

                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                        4. Hak Pengguna, Peralihan Mode &amp; Penghapusan Akun
                                    </Typography>
                                    <Typography variant="body" sx={{ color: "text.muted", display: "block" }}>
                                        Anda memiliki hak penuh untuk mengekspor data Anda kapan saja, beralih antara Mode Terkelola dan Mode Zero-Knowledge Murni (dengan jeda pengaman 7 hari anti-sabotase saat menonaktifkan escrow), atau menghapus akun Anda secara permanen beserta seluruh berkas dan deposit escrow di peladen aktif.
                                    </Typography>
                                </Box>

                                <Divider />

                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                        5. Kontak & Pertanyaan
                                    </Typography>
                                    <Typography variant="body" sx={{ color: "text.muted", display: "block" }}>
                                        Jika Anda memiliki pertanyaan tentang kebijakan privasi ini, silakan hubungi tim kami melalui{" "}
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
