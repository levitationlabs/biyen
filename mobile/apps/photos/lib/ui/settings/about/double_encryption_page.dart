import "package:ente_components/ente_components.dart";
import "package:flutter/material.dart";
import "package:hugeicons/hugeicons.dart";
import "package:photos/ui/settings/about/double_encryption_diagram.dart";

class DoubleEncryptionPage extends StatelessWidget {
  const DoubleEncryptionPage({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isId = Localizations.localeOf(context).languageCode == "id";

    final cardBg = isDark ? const Color(0xFF181513) : const Color(0xFFFAF7F3);
    final cardBorder = isDark ? const Color(0xFF2B2420) : const Color(0xFFEBE4DC);
    final primaryText = isDark ? Colors.white : const Color(0xFF2C2523);
    final secondaryText = isDark ? const Color(0xFFB0A8A0) : const Color(0xFF6B5E56);
    final mutedText = isDark ? const Color(0xFF887E76) : const Color(0xFF8C7D73);

    const terracotta = Color(0xFFC8502E);
    const amber = Color(0xFFD97706);

    return SettingsPageScaffold(
      title: isId
          ? "Arsitektur Enkripsi Ganda"
          : "Double Encryption Architecture",
      children: [
        // Intro summary card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: cardBorder, width: 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: terracotta.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    alignment: Alignment.center,
                    child: const HugeIcon(
                      icon: HugeIcons.strokeRoundedShield01,
                      size: 18,
                      color: terracotta,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      isId
                          ? "Pertahanan Berlapis (Defense-in-Depth)"
                          : "Defense-in-Depth Protection",
                      style: TextStyle(
                        fontFamily: "Outfit",
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: primaryText,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                isId
                    ? "Biyen Photos mengamankan data Anda dengan dua lapis proteksi kriptografi independen: Zero-Knowledge E2EE di perangkat Anda dan enkripsi penyimpanan AES-256 di sisi server."
                    : "Biyen Photos secures your memories with two independent cryptographic layers: Zero-Knowledge E2EE on your device and AES-256 storage encryption on the server.",
                style: TextStyle(
                  fontSize: 11,
                  height: 1.5,
                  color: secondaryText,
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: Spacing.sm),

        // Elongated horizontal vector illustration flow
        const DoubleEncryptionDiagram(),

        const SizedBox(height: Spacing.sm),

        // Section 1: Client-Side E2EE
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: cardBorder, width: 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const HugeIcon(
                    icon: HugeIcons.strokeRoundedLockKey,
                    size: 18,
                    color: terracotta,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      isId
                          ? "1. Kriptografi E2EE Klien (Arsitektur Ente)"
                          : "1. Client-Side E2EE (Ente Architecture)",
                      style: TextStyle(
                        fontFamily: "Outfit",
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: primaryText,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                isId
                    ? "Protokol End-to-End Encryption (E2EE) yang digunakan mengadopsi standar kriptografi open-source Ente yang telah melalui audit independen resmi oleh firma keamanan global Cure53 dan Kudelski Security."
                    : "The End-to-End Encryption protocol inherits Ente's open-source cryptographic standards, officially and independently audited by global security firms Cure53 and Kudelski Security.",
                style: TextStyle(
                  fontSize: 11,
                  height: 1.5,
                  color: secondaryText,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                isId
                    ? "• XChaCha20-Poly1305 (libsodium) untuk enkripsi dan otentikasi data foto.\n• Argon2id untuk hashing password dan derivasi kunci privat.\n• Zero-Knowledge: Kunci privat disimpan secara lokal di perangkat dan tidak pernah dikirim ke server."
                    : "• XChaCha20-Poly1305 (libsodium) for photo encryption and authentication.\n• Argon2id for password hashing and key derivation.\n• Zero-Knowledge: Private keys remain exclusively on your device and are never sent to any server.",
                style: TextStyle(
                  fontSize: 10.5,
                  height: 1.5,
                  color: mutedText,
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: Spacing.sm),

        // Section 2: Server-Side Storage Encryption
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: cardBorder, width: 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const HugeIcon(
                    icon: HugeIcons.strokeRoundedServerStack01,
                    size: 18,
                    color: amber,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      isId
                          ? "2. Enkripsi Penyimpanan Server (AES-256)"
                          : "2. Server-Side Storage Encryption (AES-256)",
                      style: TextStyle(
                        fontFamily: "Outfit",
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: primaryText,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                isId
                    ? "Di sisi server, seluruh berkas yang telah terenkripsi E2EE kembali dienkripsi pada tingkat penyimpanan cloud (at rest) dengan standar keamanan industri AES-256."
                    : "On the server, every E2EE encrypted file is re-encrypted at the cloud storage layer (at rest) with industry-standard AES-256.",
                style: TextStyle(
                  fontSize: 11,
                  height: 1.5,
                  color: secondaryText,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                isId
                    ? "• Enkripsi at Rest: Setiap berkas dilindungi kunci enkripsi unik sebelum ditulis ke media penyimpanan fisik.\n• Keamanan in Transit: Seluruh jalur pengiriman dilindungi dengan TLS 1.3 / HTTPS."
                    : "• Encryption at Rest: Each file is secured with a unique encryption key before being written to physical storage.\n• In-Transit Security: All data transmission is encrypted via TLS 1.3 / HTTPS.",
                style: TextStyle(
                  fontSize: 10.5,
                  height: 1.5,
                  color: mutedText,
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: Spacing.sm),

        // Section 3: Minimalist Summary
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: isDark
                ? const Color(0xFF13100E)
                : const Color(0xFFF3ECE4),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isDark ? const Color(0xFF28201C) : const Color(0xFFE2D6CA),
              width: 0.8,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(
                Icons.verified_user_rounded,
                size: 16,
                color: Color(0xFF10B981),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  isId
                      ? "Bahkan jika perangkat keras penyimpanan fisik server disusupi, foto Anda tetap mustahil dibaca tanpa kunci pribadi yang hanya tersimpan di perangkat Anda."
                      : "Even if physical server storage hardware is compromised, your photos remain impossible to decrypt without the private key stored solely on your device.",
                  style: TextStyle(
                    fontSize: 10.5,
                    height: 1.45,
                    color: secondaryText,
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: Spacing.xl),
      ],
    );
  }
}
