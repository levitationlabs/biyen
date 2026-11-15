import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'package:photos/core/configuration.dart';
import 'package:photos/core/constants.dart';

enum BiyenProtectionMode {
  managed('managed'),
  zeroKnowledge('zero_knowledge');

  final String apiValue;
  const BiyenProtectionMode(this.apiValue);
  static BiyenProtectionMode fromApiValue(String? v) =>
      v == zeroKnowledge.apiValue ? zeroKnowledge : managed;
}

enum EscrowRequestStatus {
  pending('pending'),
  approved('approved'),
  consumed('consumed'),
  expired('expired'),
  rejected('rejected');

  final String apiValue;
  const EscrowRequestStatus(this.apiValue);
  static EscrowRequestStatus fromApiValue(String? v) =>
      EscrowRequestStatus.values.firstWhere(
        (s) => s.apiValue == v,
        orElse: () => pending,
      );
}

class BiyenEscrowException implements Exception {
  final String message;
  final int? statusCode;
  const BiyenEscrowException(this.message, {this.statusCode});
  @override
  String toString() => 'BiyenEscrowException($statusCode): $message';
}

typedef EscrowPublicKey = ({String kekVersion, Uint8List publicKey});
typedef EscrowStatus = ({BiyenProtectionMode mode, DateTime? deleteScheduledAt});
typedef EscrowRecoverySession = ({String requestId, String requestCode});
typedef EscrowPollResult = ({EscrowRequestStatus status, String? recoveredKey});

class BiyenEscrowService {
  static const String cipherSuiteId =
      'biyen-escrow-v1:hpke-xwing-hkdfsha256-chacha20poly1305';
  static const String kBiyenEscrowKeyFingerprintsEnv = String.fromEnvironment(
    'BIYEN_ESCROW_KEY_FINGERPRINTS',
  );
  static const String _requestPrefix = 'biyen-escrow-v1/request|';
  static const String _commitPrefix = 'biyen-escrow-v1/commit|';
  static const String _custodyPrefix = 'biyen-escrow-v1/custody|';
  static const String _devicePrefix = 'biyen-escrow-v1/device|';
  static const String _base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  static const int _bitsPerByte = 8;
  static const int _bitsPerBase32 = 5;
  static const int _base32Mask = 0x1F;
  static const int _byteRangeMax = 256;
  static const int requestCodeCharLength = 20;
  static const int requestCodeGroupSize = 5;
  static const int xWingPublicKeyLength = 1216;
  static const int pollSecretLength = 32;
  static const int _httpOkMin = 200;
  static const int _httpOkMax = 299;

  final http.Client _httpClient;
  final String? _baseUrl;
  final Set<String>? _pinnedFingerprints;
  String? authTokenOverride;

  BiyenEscrowService({
    http.Client? httpClient,
    String? baseUrl,
    Set<String>? pinnedFingerprints,
  }) : _httpClient = httpClient ?? http.Client(),
       _baseUrl = baseUrl,
       _pinnedFingerprints = pinnedFingerprints;

  static final BiyenEscrowService instance = BiyenEscrowService();

  static String computeKeyFingerprint(Uint8List key) =>
      sha512.convert(key).toString().toLowerCase();

  static bool verifyKeyFingerprint(Uint8List key, Set<String> allowed) {
    if (allowed.isEmpty) return false;
    final digest = sha512.convert(key);
    final hexFp = digest.toString().toLowerCase();
    final b64Fp = base64Encode(digest.bytes);
    return allowed.any((c) {
      final t = c.trim();
      return t.isNotEmpty && (t.toLowerCase() == hexFp || t == b64Fp);
    });
  }

  static Uint8List computeCommitment(String userId, Uint8List recoveryKey) =>
      _sha512Concat('$_commitPrefix$userId|', recoveryKey);

  static Uint8List computePollSecretHash(Uint8List pollSecret) =>
      Uint8List.fromList(sha512.convert(pollSecret).bytes);

  static Uint8List buildCustodyInfo(String userId, String kekVersion) =>
      Uint8List.fromList(utf8.encode('$_custodyPrefix$userId|$kekVersion'));

  static Uint8List buildDeviceInfo(String requestId) =>
      Uint8List.fromList(utf8.encode('$_devicePrefix$requestId'));

  static Uint8List _sha512Concat(String prefix, Uint8List suffix) {
    final b = BytesBuilder(copy: false)
      ..add(utf8.encode(prefix))
      ..add(suffix);
    return Uint8List.fromList(sha512.convert(b.toBytes()).bytes);
  }

  static String computeRequestCode(String reqId, Uint8List devicePubKey) {
    final digest = _sha512Concat('$_requestPrefix$reqId|', devicePubKey);
    final raw = _encodeBase32Prefix(digest, requestCodeCharLength);
    return [
      for (int i = 0; i < requestCodeCharLength; i += requestCodeGroupSize)
        raw.substring(i, i + requestCodeGroupSize),
    ].join('-');
  }

  static String _encodeBase32Prefix(Uint8List bytes, int charCount) {
    final buf = StringBuffer();
    int bitBuf = 0, bits = 0;
    for (final byte in bytes) {
      bitBuf = (bitBuf << _bitsPerByte) | byte;
      bits += _bitsPerByte;
      while (bits >= _bitsPerBase32 && buf.length < charCount) {
        bits -= _bitsPerBase32;
        buf.write(_base32Chars[(bitBuf >> bits) & _base32Mask]);
      }
      if (buf.length >= charCount) break;
    }
    return buf.toString();
  }

  static Uint8List generateRandomBytes(int length) => Uint8List.fromList(
    List<int>.generate(length, (_) => Random.secure().nextInt(_byteRangeMax)),
  );

  static Uint8List decodeBinaryField(String encoded) =>
      base64Decode(encoded.trim());

  Set<String> get _pinned {
    if (_pinnedFingerprints != null) return _pinnedFingerprints;
    if (kBiyenEscrowKeyFingerprintsEnv.trim().isEmpty) return const {};
    return kBiyenEscrowKeyFingerprintsEnv
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toSet();
  }

  static const String _defaultEndpoint = String.fromEnvironment(
    'endpoint',
    defaultValue: kDefaultProductionEndpoint,
  );

  Uri _buildUri(String path) {
    final raw = _baseUrl ?? _defaultEndpoint;
    final base = raw.endsWith('/') ? raw.substring(0, raw.length - 1) : raw;
    return Uri.parse('$base$path');
  }

  Map<String, String> _authHeaders() {
    final cfg = Configuration.instance;
    final token =
        authTokenOverride ??
        (cfg.hasConfiguredAccount() ? cfg.getToken() : null);
    return {
      'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'X-Auth-Token': token,
    };
  }

  Future<Map<String, dynamic>> _authGet(String path) async =>
      _decode(await _httpClient.get(_buildUri(path), headers: _authHeaders()));

  Future<Map<String, dynamic>> _authPost(String path) async =>
      _decode(await _httpClient.post(_buildUri(path), headers: _authHeaders()));

  Future<EscrowPublicKey> fetchPublicKey() async {
    final data = await _authGet('/escrow/v1/public-key');
    final pubKey = decodeBinaryField(data['public_key'] as String);
    if (_pinned.isNotEmpty && !verifyKeyFingerprint(pubKey, _pinned)) {
      throw const BiyenEscrowException(
        'Fingerprint public key Admin tidak cocok dengan pin keamanan aplikasi.',
      );
    }
    return (
      kekVersion: (data['kek_version'] as String?) ?? 'v1',
      publicKey: pubKey,
    );
  }

  Future<EscrowStatus> depositRecoveryKey(
    String kekVersion,
    Uint8List custodyBlob,
    Uint8List commitment,
  ) async {
    final body = jsonEncode({
      'kek_version': kekVersion,
      'cipher_suite': cipherSuiteId,
      'custody_blob': base64Encode(custodyBlob),
      'recovery_key_commitment': base64Encode(commitment),
    });
    final res = await _httpClient.put(
      _buildUri('/escrow/v1/deposit'),
      headers: _authHeaders(),
      body: body,
    );
    final data = _decode(res);
    return _parseStatus({
      'mode': data['mode'] ?? BiyenProtectionMode.managed.apiValue,
      'delete_scheduled_at': data['delete_scheduled_at'],
    });
  }

  Future<EscrowStatus> getStatus() async =>
      _parseStatus(await _authGet('/escrow/v1/status'));

  Future<EscrowStatus> scheduleZeroKnowledgeSwitch() async =>
      _parseStatus(await _authPost('/escrow/v1/zero-knowledge'));

  Future<EscrowStatus> cancelZeroKnowledgeSwitch() async =>
      _parseStatus(await _authPost('/escrow/v1/zero-knowledge/cancel'));

  Future<EscrowRecoverySession> createRecoveryRequest(
    Uint8List devicePubKey,
    Uint8List pollSecret, [
    String? claimedEmail,
  ]) async {
    final payload = <String, dynamic>{
      'device_public_key': base64Encode(devicePubKey),
      'poll_secret_hash': base64Encode(computePollSecretHash(pollSecret)),
      if (claimedEmail != null && claimedEmail.trim().isNotEmpty)
        'claimed_email': claimedEmail.trim(),
    };
    final res = await _httpClient.post(
      _buildUri('/escrow/v1/recovery-requests'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );
    final data = _decode(res);
    final reqId = data['request_id'] as String;
    return (
      requestId: reqId,
      requestCode: computeRequestCode(reqId, devicePubKey),
    );
  }

  Future<EscrowPollResult> pollRecoveryRequest(
    String requestId,
    Uint8List pollSecret,
  ) async {
    final res = await _httpClient.get(
      _buildUri('/escrow/v1/recovery-requests/$requestId'),
      headers: {'X-Poll-Secret': base64Encode(pollSecret)},
    );
    final data = _decode(res);
    final rawBlob = data['device_blob'] as String?;
    final key =
        (data['recovered_key'] as String?) ??
        (rawBlob != null && rawBlob.isNotEmpty
            ? utf8.decode(decodeBinaryField(rawBlob), allowMalformed: true)
            : null);
    return (
      status: EscrowRequestStatus.fromApiValue(data['status'] as String?),
      recoveredKey: key,
    );
  }

  EscrowStatus _parseStatus(Map<String, dynamic> json) {
    final rawDel = json['delete_scheduled_at'] as String?;
    return (
      mode: BiyenProtectionMode.fromApiValue(json['mode'] as String?),
      deleteScheduledAt: rawDel != null ? DateTime.tryParse(rawDel) : null,
    );
  }

  Map<String, dynamic> _decode(http.Response res) {
    if (res.statusCode < _httpOkMin || res.statusCode > _httpOkMax) {
      final msg = res.body.isNotEmpty
          ? res.body
          : 'Permintaan layanan escrow gagal (${res.statusCode}).';
      throw BiyenEscrowException(msg, statusCode: res.statusCode);
    }
    if (res.body.trim().isEmpty) return const {};
    return jsonDecode(res.body) as Map<String, dynamic>;
  }
}
