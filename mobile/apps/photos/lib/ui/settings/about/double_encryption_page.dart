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
        // Top summary
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
                    ? "Biyen Photos melindungi privasi kenangan Anda dengan dua lapisan kriptografi terpisah: Zero-Knowledge E2EE di perangkat Anda (diwariskan dari arsitektur Ente yang telah diaudit) dan Server-Side Encryption AES-256 pada infrastruktur penyimpanan cloud Backblaze B2."
                    : "Biyen Photos protects your memories with two distinct cryptographic layers: Zero-Knowledge E2EE on your device (inherited from Ente's audited architecture) and Server-Side Encryption AES-256 on Backblaze B2 cloud storage.",
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

        // Section 1: Audited Ente Architecture
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
                          ? "1. Kriptografi E2EE Teruji & Diaudit"
                          : "1. Audited & Battle-Tested E2EE",
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
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: [
                  _buildAuditBadge(label: "Diaudit oleh Cure53", color: terracotta),
                  _buildAuditBadge(label: "Diaudit oleh Kudelski Security", color: terracotta),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                isId
                    ? "Arsitektur End-to-End Encryption (E2EE) yang digunakan Biyen mengadopsi protokol kriptografi open-source Ente yang telah diaudit independen secara resmi oleh firma keamanan siber global:"
                    : "The End-to-End Encryption (E2EE) architecture used by Biyen inherits Ente's open-source cryptographic protocols, officially audited by global cybersecurity firms:",
                style: TextStyle(
                  fontSize: 11,
                  height: 1.5,
                  color: secondaryText,
                ),
              ),
              const SizedBox(height: 8),
              _buildBulletItem(
                title: "Cure53 (Berlin)",
                desc: isId
                    ? "Audit penetrasi menyeluruh dan verifikasi kode sumber aplikasi."
                    : "Comprehensive penetration testing and application source code audit.",
                primaryText: primaryText,
                secondaryText: secondaryText,
              ),
              const SizedBox(height: 6),
              _buildBulletItem(
                title: "Kudelski Security (Swiss)",
                desc: isId
                    ? "Audit mendalam atas integritas protokol kriptografi, pertukaran kunci, dan mekanisme derivasi."
                    : "In-depth audit of cryptographic protocol integrity, key exchange, and key derivation.",
                primaryText: primaryText,
                secondaryText: secondaryText,
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.03)
                      : Colors.black.withValues(alpha: 0.02),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isId ? "Spesifikasi Kriptografi Klien:" : "Client Cryptography Specifications:",
                      style: TextStyle(
                        fontFamily: "Outfit",
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: primaryText,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      isId
                          ? "• XChaCha20-Poly1305 (libsodium) untuk enkripsi & otentikasi data.\n• Argon2id untuk hashing password & derivasi kunci enkripsi.\n• Kunci privat hanya tersimpan di perangkat (Zero-Knowledge)."
                          : "• XChaCha20-Poly1305 (libsodium) for data encryption and authentication.\n• Argon2id for password hashing and key derivation.\n• Private keys remain strictly on-device (Zero-Knowledge).",
                      style: TextStyle(
                        fontSize: 10,
                        height: 1.45,
                        color: mutedText,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: Spacing.sm),

        // Section 2: Server-Side AES-256 Storage (Backblaze B2)
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
                          ? "2. Enkripsi Penyimpanan Server (Backblaze B2)"
                          : "2. Server-Side Storage Encryption (Backblaze B2)",
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
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: [
                  _buildAuditBadge(label: "Backblaze B2 Cloud Storage", color: amber),
                  _buildAuditBadge(label: "SSE AES-256 at Rest", color: amber),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                isId
                    ? "Di sisi server, seluruh berkas yang sudah terenkripsi E2EE disimpan di infrastruktur Backblaze B2 dengan enkripsi tingkat server (Server-Side Encryption / SSE) menggunakan standar industri AES-256."
                    : "On the server side, all E2EE encrypted objects are stored on Backblaze B2 cloud infrastructure with Server-Side Encryption (SSE) utilizing industry-standard AES-256.",
                style: TextStyle(
                  fontSize: 11,
                  height: 1.5,
                  color: secondaryText,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                isId
                    ? "• Enkripsi at Rest: Setiap berkas dienkripsi secara otomatis menggunakan kunci unik AES-256 sebelum ditulis ke piringan disk fisik.\n• Perlindungan Ekstra: Mencegah risiko pembobolan hardware fisik pada data center.\n• Enkripsi in Transit: Seluruh jalur pengiriman data diamankan dengan TLS 1.3 / HTTPS."
                    : "• Encryption at Rest: Every file is automatically encrypted with a unique AES-256 key before being committed to physical storage.\n• Physical Protection: Protects against physical hardware breaches in data centers.\n• In-Transit Security: All communication channels are secured with TLS 1.3 / HTTPS.",
                style: TextStyle(
                  fontSize: 10,
                  height: 1.5,
                  color: mutedText,
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: Spacing.sm),

        // Section 3: Summary of Dual Security
        Container(
          padding: const EdgeInsets.all(14),
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
                      ? "Kesimpulan: Data foto Anda memiliki proteksi ganda. Bahkan jika penyedia storage atau infrastruktur server disusupi secara fisik, isi foto Anda tetap mustahil dibuka tanpa kunci privat yang hanya tersimpan di perangkat Anda."
                      : "Summary: Your photo data is doubly protected. Even if storage providers or server hardware are physically compromised, your photos remain mathematically impossible to decrypt without your on-device private key.",
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

  Widget _buildAuditBadge({required String label, required Color color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.25), width: 0.8),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontFamily: "Outfit",
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }

  Widget _buildBulletItem({
    required String title,
    required String desc,
    required Color primaryText,
    required Color secondaryText,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 4),
          child: Icon(Icons.circle, size: 5, color: Color(0xFFC8502E)),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: RichText(
            text: TextSpan(
              style: TextStyle(fontSize: 11, height: 1.4, color: secondaryText),
              children: [
                TextSpan(
                  text: "$title: ",
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: primaryText,
                  ),
                ),
                TextSpan(text: desc),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
