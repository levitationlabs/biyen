import 'dart:convert';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:photos/services/account/biyen_escrow_service.dart';

void main() {
  const testRequestId = '550e8400-e29b-41d4-a716-446655440000';
  const testUserId = '1042';
  const expectedFormattedCodeLength = 23;
  const sha512ByteLength = 64;
  const sampleKeyByteLength = 32;
  const byteMask = 0xFF;
  const httpStatusOk = 200;
  const httpStatusForbidden = 403;

  group('BiyenEscrowService cryptographic primitives', () {
    test(
      'computeRequestCode returns deterministic 20-char Base32 code in XXXXX-XXXXX-XXXXX-XXXXX format',
      () {
        const len = BiyenEscrowService.xWingPublicKeyLength;
        final pubKeyA = Uint8List.fromList(
          List<int>.generate(len, (i) => i & byteMask),
        );
        final pubKeyB = Uint8List.fromList(
          List<int>.generate(len, (i) => (i + 1) & byteMask),
        );

        final code1 = BiyenEscrowService.computeRequestCode(
          testRequestId,
          pubKeyA,
        );
        final code2 = BiyenEscrowService.computeRequestCode(
          testRequestId,
          pubKeyA,
        );
        final diffKeyCode = BiyenEscrowService.computeRequestCode(
          testRequestId,
          pubKeyB,
        );
        final diffReqCode = BiyenEscrowService.computeRequestCode(
          'other-request-id',
          pubKeyA,
        );

        expect(code1, equals(code2));
        expect(code1.length, equals(expectedFormattedCodeLength));
        expect(
          RegExp(
            r'^[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}$',
          ).hasMatch(code1),
          isTrue,
        );
        expect(code1, isNot(equals(diffKeyCode)));
        expect(code1, isNot(equals(diffReqCode)));
      },
    );

    test(
      'computeCommitment binds domain prefix, userId, and recoveryKey into SHA-512 digest',
      () {
        final recoveryKey = Uint8List.fromList(
          utf8.encode('0123456789abcdef0123456789abcdef'),
        );
        final expectedInput = BytesBuilder()
          ..add(utf8.encode('biyen-escrow-v1/commit|$testUserId|'))
          ..add(recoveryKey);
        final expectedDigest = Uint8List.fromList(
          sha512.convert(expectedInput.toBytes()).bytes,
        );

        final commitment = BiyenEscrowService.computeCommitment(
          testUserId,
          recoveryKey,
        );
        final otherUser = BiyenEscrowService.computeCommitment(
          '9999',
          recoveryKey,
        );

        expect(commitment, equals(expectedDigest));
        expect(commitment.length, equals(sha512ByteLength));
        expect(commitment, isNot(equals(otherUser)));
      },
    );

    test(
      'verifyKeyFingerprint accepts matching SHA-512 hex or base64 pin and rejects mismatched keys',
      () {
        const len = BiyenEscrowService.xWingPublicKeyLength;
        final adminKey = Uint8List.fromList(
          List<int>.generate(len, (i) => i & byteMask),
        );
        final badKey = Uint8List.fromList(
          List<int>.generate(len, (i) => (i + 3) & byteMask),
        );
        final hexPin = BiyenEscrowService.computeKeyFingerprint(adminKey);
        final b64Pin = base64Encode(sha512.convert(adminKey).bytes);

        expect(
          BiyenEscrowService.verifyKeyFingerprint(adminKey, {
            hexPin.toUpperCase(),
          }),
          isTrue,
        );
        expect(
          BiyenEscrowService.verifyKeyFingerprint(adminKey, {b64Pin}),
          isTrue,
        );
        expect(
          BiyenEscrowService.verifyKeyFingerprint(badKey, {hexPin}),
          isFalse,
        );
        expect(
          BiyenEscrowService.verifyKeyFingerprint(adminKey, const {}),
          isFalse,
        );
      },
    );
  });

  group('BiyenEscrowService REST API contract (/escrow/v1/*)', () {
    test(
      'fetchPublicKey verifies pinned fingerprint and throws BiyenEscrowException on pin mismatch',
      () async {
        final validKey = Uint8List.fromList(
          List<int>.generate(sampleKeyByteLength, (i) => i + 1),
        );
        final validPin = BiyenEscrowService.computeKeyFingerprint(validKey);
        final mockClient = MockClient((req) async {
          expect(req.url.path, equals('/escrow/v1/public-key'));
          expect(req.headers['X-Auth-Token'], equals('tok-123'));
          final payload = jsonEncode({
            'kek_version': 'v1',
            'cipher_suite': BiyenEscrowService.cipherSuiteId,
            'public_key': base64Encode(validKey),
          });
          return http.Response(payload, httpStatusOk);
        });

        final trusted = BiyenEscrowService(
          httpClient: mockClient,
          baseUrl: 'https://api.biyen.test',
          pinnedFingerprints: {validPin},
        )..authTokenOverride = 'tok-123';
        final fetched = await trusted.fetchPublicKey();
        expect(fetched.kekVersion, equals('v1'));
        expect(fetched.publicKey, equals(validKey));

        final untrusted = BiyenEscrowService(
          httpClient: mockClient,
          baseUrl: 'https://api.biyen.test',
          pinnedFingerprints: {'deadbeef'},
        )..authTokenOverride = 'tok-123';
        expect(
          untrusted.fetchPublicKey,
          throwsA(isA<BiyenEscrowException>()),
        );
      },
    );

    test(
      'depositRecoveryKey, getStatus, scheduleZeroKnowledgeSwitch, and cancelZeroKnowledgeSwitch handle payloads',
      () async {
        final calls = <String>[];
        final mockClient = MockClient((req) async {
          calls.add('${req.method} ${req.url.path}');
          if (req.method == 'PUT' && req.url.path == '/escrow/v1/deposit') {
            final body = jsonDecode(req.body) as Map<String, dynamic>;
            expect(body['kek_version'], equals('v1'));
            expect(
              body['cipher_suite'],
              equals(BiyenEscrowService.cipherSuiteId),
            );
          }
          final delAt = req.url.path == '/escrow/v1/zero-knowledge'
              ? '2026-11-22T15:00:00Z'
              : null;
          return http.Response(
            jsonEncode({'mode': 'managed', 'delete_scheduled_at': delAt}),
            httpStatusOk,
          );
        });

        final service = BiyenEscrowService(
          httpClient: mockClient,
          baseUrl: 'https://api.biyen.test',
        )..authTokenOverride = 'tok-user';

        final deposited = await service.depositRecoveryKey(
          'v1',
          Uint8List.fromList([1, 2, 3]),
          Uint8List.fromList(List<int>.filled(sha512ByteLength, 9)),
        );
        expect(deposited.mode, equals(BiyenProtectionMode.managed));

        final scheduled = await service.scheduleZeroKnowledgeSwitch();
        expect(scheduled.deleteScheduledAt, isNotNull);

        final canceled = await service.cancelZeroKnowledgeSwitch();
        expect(canceled.deleteScheduledAt, isNull);

        final status = await service.getStatus();
        expect(status.mode, equals(BiyenProtectionMode.managed));
        expect(
          calls,
          containsAll([
            'PUT /escrow/v1/deposit',
            'POST /escrow/v1/zero-knowledge',
            'POST /escrow/v1/zero-knowledge/cancel',
            'GET /escrow/v1/status',
          ]),
        );
      },
    );

    test(
      'createRecoveryRequest and pollRecoveryRequest complete recovery lifecycle',
      () async {
        final pubKey = Uint8List.fromList(
          List<int>.filled(sampleKeyByteLength, 7),
        );
        final pollSecret = Uint8List.fromList(
          List<int>.filled(sampleKeyByteLength, 5),
        );
        const expectedMnemonic = 'abandon ability able about above';

        final mockClient = MockClient((req) async {
          if (req.method == 'POST' &&
              req.url.path == '/escrow/v1/recovery-requests') {
            final body = jsonDecode(req.body) as Map<String, dynamic>;
            final expectedHash = base64Encode(
              BiyenEscrowService.computePollSecretHash(pollSecret),
            );
            expect(body['poll_secret_hash'], equals(expectedHash));
            expect(body['claimed_email'], equals('user@biyen.id'));
            return http.Response(
              jsonEncode({'request_id': testRequestId}),
              httpStatusOk,
            );
          }
          if (req.method == 'GET' &&
              req.url.path == '/escrow/v1/recovery-requests/$testRequestId') {
            expect(
              req.headers['X-Poll-Secret'],
              equals(base64Encode(pollSecret)),
            );
            final payload = jsonEncode({
              'request_id': testRequestId,
              'status': 'approved',
              'device_blob': base64Encode(utf8.encode(expectedMnemonic)),
            });
            return http.Response(payload, httpStatusOk);
          }
          return http.Response('Forbidden', httpStatusForbidden);
        });

        final service = BiyenEscrowService(
          httpClient: mockClient,
          baseUrl: 'https://api.biyen.test',
        );
        final session = await service.createRecoveryRequest(
          pubKey,
          pollSecret,
          'user@biyen.id',
        );
        expect(session.requestId, equals(testRequestId));
        expect(
          session.requestCode,
          equals(BiyenEscrowService.computeRequestCode(testRequestId, pubKey)),
        );

        final polled = await service.pollRecoveryRequest(
          session.requestId,
          pollSecret,
        );
        expect(polled.status, equals(EscrowRequestStatus.approved));
        expect(polled.recoveredKey, equals(expectedMnemonic));
      },
    );
  });
}
