import "package:ente_components/ente_components.dart";
import "package:flutter/material.dart";
import "package:hugeicons/hugeicons.dart";

class DoubleEncryptionDiagram extends StatelessWidget {
  const DoubleEncryptionDiagram({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isId = Localizations.localeOf(context).languageCode == "id";

    final cardBg = isDark ? const Color(0xFF181513) : const Color(0xFFFAF7F3);
    final cardBorder = isDark ? const Color(0xFF2B2420) : const Color(0xFFEBE4DC);
    final innerBg = isDark ? const Color(0xFF13100E) : const Color(0xFFF2ECE5);
    final innerBorder = isDark ? const Color(0xFF241D19) : const Color(0xFFE3D9CD);
    final nodeBg = isDark ? const Color(0xFF231C18) : Colors.white;
    final nodeBorder = isDark ? const Color(0xFF382E28) : const Color(0xFFD8CEC2);
    final primaryText = isDark ? Colors.white : const Color(0xFF2C2523);
    final secondaryText = isDark ? const Color(0xFFB0A8A0) : const Color(0xFF6B5E56);
    final mutedText = isDark ? const Color(0xFF887E76) : const Color(0xFF8C7D73);

    const terracotta = Color(0xFFC8502E);
    const amber = Color(0xFFD97706);

    return Container(
      margin: const EdgeInsets.only(top: Spacing.md, bottom: Spacing.sm),
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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isId
                          ? "Arsitektur Enkripsi Ganda"
                          : "Double Encryption Architecture",
                      style: TextStyle(
                        fontFamily: "Outfit",
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: primaryText,
                      ),
                    ),
                    Text(
                      isId
                          ? "E2EE Client (Ente) + AES-256 Server (Biyen)"
                          : "Client E2EE (Ente) + Server AES-256 (Biyen)",
                      style: TextStyle(
                        fontSize: 11,
                        color: mutedText,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: terracotta.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: terracotta.withValues(alpha: 0.25),
                    width: 0.8,
                  ),
                ),
                child: const Text(
                  "Zero-Knowledge",
                  style: TextStyle(
                    fontFamily: "Outfit",
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: terracotta,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Elongated horizontal vector illustration flow
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
            decoration: BoxDecoration(
              color: innerBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: innerBorder, width: 0.8),
            ),
            child: Row(
              children: [
                _buildNode(
                  icon: HugeIcons.strokeRoundedSmartPhone01,
                  title: isId ? "Perangkat" : "Device",
                  subtitle: isId ? "Klien" : "Client",
                  bgColor: nodeBg,
                  borderColor: nodeBorder,
                  primaryText: primaryText,
                  mutedText: mutedText,
                ),
                Expanded(
                  child: _buildConnector(
                    badgeLabel: "E2EE",
                    cipherLabel: "XChaCha20",
                    badgeColor: terracotta,
                    lineColor: terracotta,
                  ),
                ),
                _buildNode(
                  icon: HugeIcons.strokeRoundedServerStack01,
                  title: "Server",
                  subtitle: "Biyen",
                  iconColor: terracotta,
                  bgColor: nodeBg,
                  borderColor: terracotta.withValues(alpha: 0.4),
                  primaryText: primaryText,
                  mutedText: mutedText,
                ),
                Expanded(
                  child: _buildConnector(
                    badgeLabel: "AES-256",
                    cipherLabel: "GCM Rest",
                    badgeColor: amber,
                    lineColor: amber,
                  ),
                ),
                _buildNode(
                  icon: HugeIcons.strokeRoundedDatabase01,
                  title: "Storage",
                  subtitle: isId ? "Cloud" : "Vault",
                  bgColor: nodeBg,
                  borderColor: nodeBorder,
                  primaryText: primaryText,
                  mutedText: mutedText,
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Security explanation layers
          _buildLayerExplanation(
            icon: HugeIcons.strokeRoundedLockKey,
            iconColor: terracotta,
            title: isId
                ? "1. End-to-End Encryption (Arsitektur Ente)"
                : "1. End-to-End Encryption (Ente Architecture)",
            description: isId
                ? "Foto dan metadata dienkripsi langsung di perangkat Anda sebelum diunggah menggunakan algoritma XChaCha20-Poly1305 (libsodium) & derivasi kunci Argon2id. Hanya Anda yang memiliki kunci privat."
                : "Photos and metadata are encrypted directly on your device prior to upload using XChaCha20-Poly1305 (libsodium) and Argon2id. Only you hold the private keys.",
            primaryText: primaryText,
            secondaryText: secondaryText,
          ),
          const SizedBox(height: 10),
          _buildLayerExplanation(
            icon: HugeIcons.strokeRoundedKey01,
            iconColor: amber,
            title: isId
                ? "2. Server-Side Storage Encryption (Server Biyen)"
                : "2. Server-Side Storage Encryption (Biyen Server)",
            description: isId
                ? "Setiap berkas yang tersimpan di cloud Biyen dienkripsi kembali pada tingkat storage (at rest) dengan standar AES-256-GCM oleh infrastruktur Levitation."
                : "Every file stored on Biyen cloud infrastructure is re-encrypted at rest at the storage layer with military-grade AES-256-GCM by Levitation.",
            primaryText: primaryText,
            secondaryText: secondaryText,
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.03)
                  : Colors.black.withValues(alpha: 0.02),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.check_circle_outline_rounded,
                  size: 14,
                  color: Color(0xFF10B981),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    isId
                        ? "Keamanan Berlapis (Defense-in-Depth): Bahkan jika lapisan storage server terekspos fisik, isi foto Anda mustahil dibaca tanpa kunci pribadi Anda."
                        : "Layered Defense-in-Depth: Even if the server storage layer is physically accessed, photos remain unreadable without your private key.",
                    style: TextStyle(
                      fontSize: 10,
                      height: 1.4,
                      color: mutedText,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNode({
    required dynamic icon,
    required String title,
    required String subtitle,
    required Color bgColor,
    required Color borderColor,
    required Color primaryText,
    required Color mutedText,
    Color? iconColor,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: borderColor, width: 1),
          ),
          alignment: Alignment.center,
          child: HugeIcon(
            icon: icon,
            size: 18,
            color: iconColor ?? primaryText,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          title,
          style: TextStyle(
            fontFamily: "Outfit",
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: primaryText,
          ),
        ),
        Text(
          subtitle,
          style: TextStyle(
            fontSize: 9,
            color: mutedText,
          ),
        ),
      ],
    );
  }

  Widget _buildConnector({
    required String badgeLabel,
    required String cipherLabel,
    required Color badgeColor,
    required Color lineColor,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1.5),
            decoration: BoxDecoration(
              color: badgeColor,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              badgeLabel,
              style: const TextStyle(
                fontFamily: "Outfit",
                fontSize: 8,
                fontWeight: FontWeight.w800,
                color: Colors.white,
                letterSpacing: 0.2,
              ),
            ),
          ),
          const SizedBox(height: 3),
          SizedBox(
            height: 10,
            width: double.infinity,
            child: CustomPaint(
              painter: _FlowArrowPainter(color: lineColor),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            cipherLabel,
            style: TextStyle(
              fontFamily: "Outfit",
              fontSize: 8,
              fontWeight: FontWeight.w600,
              color: badgeColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLayerExplanation({
    required dynamic icon,
    required Color iconColor,
    required String title,
    required String description,
    required Color primaryText,
    required Color secondaryText,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: HugeIcon(icon: icon, size: 14, color: iconColor),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontFamily: "Outfit",
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: primaryText,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                description,
                style: TextStyle(
                  fontSize: 10,
                  height: 1.4,
                  color: secondaryText,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _FlowArrowPainter extends CustomPainter {
  const _FlowArrowPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color.withValues(alpha: 0.8)
      ..strokeWidth = 1.2
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final y = size.height / 2;
    const arrowSize = 3.0;

    // Draw connecting line
    canvas.drawLine(
      Offset(0, y),
      Offset(size.width - arrowSize, y),
      paint,
    );

    // Draw arrowhead
    final fillPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final path = Path()
      ..moveTo(size.width, y)
      ..lineTo(size.width - arrowSize * 1.5, y - arrowSize)
      ..lineTo(size.width - arrowSize * 1.5, y + arrowSize)
      ..close();

    canvas.drawPath(path, fillPaint);
  }

  @override
  bool shouldRepaint(covariant _FlowArrowPainter oldDelegate) =>
      oldDelegate.color != color;
}
