import 'package:ente_components/ente_components.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:photos/core/configuration.dart';
import 'package:photos/core/constants.dart';
import 'package:photos/services/account/biyen_escrow_service.dart';
import 'package:photos/ui/notification/toast.dart';
import 'package:uuid/uuid.dart';

class BiyenSupportRecoveryPage extends StatefulWidget {
  final BiyenEscrowService? escrowService;
  final String? initialEmail;

  const BiyenSupportRecoveryPage({
    this.escrowService,
    this.initialEmail,
    super.key,
  });

  @override
  State<BiyenSupportRecoveryPage> createState() =>
      _BiyenSupportRecoveryPageState();
}

class _BiyenSupportRecoveryPageState extends State<BiyenSupportRecoveryPage> {
  static const double _cardBorderWidth = 1.0;

  Uint8List? _pollSecret;
  String? _requestId;
  String? _requestCode;
  String _statusMessage =
      'Menunggu verifikasi identitas Support & persetujuan Admin (berlaku 72 jam).';
  bool _isLoading = true;

  BiyenEscrowService get _service =>
      widget.escrowService ?? BiyenEscrowService.instance;

  @override
  void initState() {
    super.initState();
    _initializeRecoveryRequest();
  }

  Future<void> _initializeRecoveryRequest() async {
    setState(() => _isLoading = true);
    final pubKey = BiyenEscrowService.generateRandomBytes(
      BiyenEscrowService.xWingPublicKeyLength,
    );
    final secret = BiyenEscrowService.generateRandomBytes(
      BiyenEscrowService.pollSecretLength,
    );
    _pollSecret = secret;
    final cfg = Configuration.instance;
    final email =
        widget.initialEmail ??
        (cfg.hasConfiguredAccount() ? cfg.getEmail() : null);
    try {
      final session = await _service.createRecoveryRequest(
        pubKey,
        secret,
        email,
      );
      if (!mounted) return;
      setState(() {
        _requestId = session.requestId;
        _requestCode = session.requestCode;
        _isLoading = false;
      });
    } catch (_) {
      final localId = const Uuid().v4();
      if (!mounted) return;
      setState(() {
        _requestId = localId;
        _requestCode = BiyenEscrowService.computeRequestCode(localId, pubKey);
        _isLoading = false;
      });
    }
  }

  Future<void> _copyRequestCode() async {
    final code = _requestCode;
    if (code == null || code.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: code));
    if (!mounted) return;
    showShortToast(context, 'Kode Permintaan berhasil disalin.');
  }

  Future<void> _pollStatus() async {
    final reqId = _requestId;
    final secret = _pollSecret;
    if (reqId == null || secret == null) return;
    try {
      final result = await _service.pollRecoveryRequest(reqId, secret);
      if (!mounted) return;
      if (result.status == EscrowRequestStatus.approved &&
          result.recoveredKey != null &&
          result.recoveredKey!.isNotEmpty) {
        showShortToast(context, 'Pemulihan disetujui Admin.');
        Navigator.of(context).pop(result.recoveredKey!.trim());
        return;
      }
      setState(() => _statusMessage = _describeStatus(result.status));
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _statusMessage =
            'Belum dapat mengambil status persetujuan. Silakan coba lagi setelah konfirmasi Support.';
      });
    }
  }

  String _describeStatus(EscrowRequestStatus status) {
    switch (status) {
      case EscrowRequestStatus.approved:
        return 'Permintaan telah disetujui Admin, menunggu masa jeda pelepasan selesai.';
      case EscrowRequestStatus.rejected:
        return 'Permintaan pemulihan ditolak oleh Admin.';
      case EscrowRequestStatus.expired:
        return 'Permintaan telah kedaluwarsa (72 jam). Silakan buat permintaan baru.';
      case EscrowRequestStatus.consumed:
        return 'Paket pemulihan ini sudah pernah digunakan.';
      case EscrowRequestStatus.pending:
        return 'Permintaan masih berstatus menunggu verifikasi Support & persetujuan Admin.';
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.componentColors;
    return Scaffold(
      backgroundColor: colors.backgroundBase,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: colors.backgroundBase,
        title: Text(
          'Pulihkan via Support Biyen',
          style: TextStyles.large.copyWith(color: colors.textBase),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(Spacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildCodeCard(),
              const SizedBox(height: Spacing.lg),
              _buildInstructionsCard(),
              const SizedBox(height: Spacing.lg),
              Text(
                _statusMessage,
                key: const ValueKey('escrowPollStatusText'),
                textAlign: TextAlign.center,
                style: TextStyles.body.copyWith(color: colors.textLight),
              ),
              const SizedBox(height: Spacing.lg),
              ButtonComponent(
                key: const ValueKey('pollApprovalStatusButton'),
                label: 'Cek Status Persetujuan Admin',
                isDisabled: _isLoading,
                onTap: _pollStatus,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCodeCard() {
    final colors = context.componentColors;
    return Container(
      padding: const EdgeInsets.all(Spacing.lg),
      decoration: BoxDecoration(
        color: colors.backgroundBase,
        borderRadius: BorderRadius.circular(Radii.button),
        border: Border.all(color: colors.strokeFaint, width: _cardBorderWidth),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Kode Permintaan Perangkat (20 Karakter — Berlaku 72 Jam)',
            style: TextStyles.bodyBold.copyWith(color: colors.textLight),
          ),
          const SizedBox(height: Spacing.sm),
          SelectableText(
            _requestCode ?? 'Membuat kode...',
            key: const ValueKey('escrowRequestCodeText'),
            textAlign: TextAlign.center,
            style: TextStyles.large.copyWith(color: colors.textBase),
          ),
          const SizedBox(height: Spacing.md),
          ButtonComponent(
            key: const ValueKey('copyRequestCodeButton'),
            label: 'Salin Kode Permintaan',
            variant: ButtonComponentVariant.secondary,
            size: ButtonComponentSize.small,
            shouldSurfaceExecutionStates: false,
            onTap: _copyRequestCode,
          ),
        ],
      ),
    );
  }

  Widget _buildInstructionsCard() {
    final colors = context.componentColors;
    return Container(
      padding: const EdgeInsets.all(Spacing.lg),
      decoration: BoxDecoration(
        color: colors.backgroundBase,
        borderRadius: BorderRadius.circular(Radii.button),
        border: Border.all(color: colors.strokeFaint, width: _cardBorderWidth),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Langkah Pemulihan Managed Escrow',
            style: TextStyles.bodyBold.copyWith(color: colors.textBase),
          ),
          const SizedBox(height: Spacing.sm),
          Text(
            '1. Salin Kode Permintaan 20 karakter di atas.\n'
            '2. Hubungi Support Biyen melalui WhatsApp atau Email ($supportEmail) dengan menyertakan Kode Permintaan dan bukti identitas.\n'
            '3. Setelah Admin memverifikasi dan menyetujui permintaan Anda, ketuk tombol "Cek Status Persetujuan Admin" di bawah.',
            style: TextStyles.body.copyWith(color: colors.textLight),
          ),
        ],
      ),
    );
  }
}
