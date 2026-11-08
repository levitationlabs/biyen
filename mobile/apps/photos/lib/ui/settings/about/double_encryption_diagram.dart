import "package:flutter/material.dart";
import "package:hugeicons/hugeicons.dart";

class DoubleEncryptionDiagram extends StatelessWidget {
  const DoubleEncryptionDiagram({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isId = Localizations.localeOf(context).languageCode == "id";

    final innerBg = isDark ? const Color(0xFF13100E) : const Color(0xFFF2ECE5);
    final innerBorder = isDark ? const Color(0xFF241D19) : const Color(0xFFE3D9CD);
    final nodeBg = isDark ? const Color(0xFF231C18) : Colors.white;
    final nodeBorder = isDark ? const Color(0xFF382E28) : const Color(0xFFD8CEC2);
    final primaryText = isDark ? Colors.white : const Color(0xFF2C2523);
    final mutedText = isDark ? const Color(0xFF887E76) : const Color(0xFF8C7D73);

    const terracotta = Color(0xFFC8502E);
    const amber = Color(0xFFD97706);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: innerBg,
        borderRadius: BorderRadius.circular(14),
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
              cipherLabel: "Backblaze",
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
