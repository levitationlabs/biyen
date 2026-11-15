use hpke::{Deserializable, Kem as HpkeKem, OpModeR, OpModeS, Serializable};
use sha2::{Digest, Sha512};
use subtle::ConstantTimeEq;
use zeroize::ZeroizeOnDrop;

use crate::crypto::{Error, Result, fill_random};

type Aead = ::hpke::aead::ChaCha20Poly1305;
type Kdf = ::hpke::kdf::HkdfSha256;
type Kem = ::hpke::kem::XWing;

const COMMITMENT_DOMAIN_PREFIX: &str = "biyen-escrow-v1/commit|";
const REQUEST_CODE_DOMAIN_PREFIX: &str = "biyen-escrow-v1/request|";
const BASE32_ALPHABET: &[u8; 32] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE32_BLOCK_BYTES: usize = 5;
const BASE32_BLOCK_CHARS: usize = 8;
const REQUEST_CODE_RAW_LEN: usize = 20;
const REQUEST_CODE_GROUP_LEN: usize = 5;
const SHA512_BYTES: usize = 64;
const HEX_CHARS: &[u8; 16] = b"0123456789abcdef";

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PublicKey([u8; Self::BYTES]);

impl PublicKey {
    pub const BYTES: usize = 1216;

    pub fn try_from_slice(bytes: &[u8]) -> Result<Self> {
        if bytes.len() != Self::BYTES {
            return Err(Error::InvalidKeyLength {
                expected: Self::BYTES,
                actual: bytes.len(),
            });
        }
        <Kem as HpkeKem>::PublicKey::from_bytes(bytes).map_err(|_| Error::InvalidPublicKey)?;
        Ok(Self(bytes.try_into()?))
    }

    pub fn as_bytes(&self) -> &[u8; Self::BYTES] {
        &self.0
    }

    fn hpke_key(&self) -> <Kem as HpkeKem>::PublicKey {
        #[expect(
            clippy::expect_used,
            reason = "PublicKey construction validates these bytes"
        )]
        <Kem as HpkeKem>::PublicKey::from_bytes(&self.0)
            .expect("PublicKey is validated when constructed")
    }
}

#[derive(ZeroizeOnDrop)]
pub struct SecretKey([u8; Self::BYTES]);

impl SecretKey {
    pub const BYTES: usize = 32;

    pub fn generate() -> Self {
        let mut bytes = [0u8; Self::BYTES];
        fill_random(&mut bytes);
        Self(bytes)
    }

    pub fn from_bytes(bytes: [u8; Self::BYTES]) -> Self {
        Self(bytes)
    }

    pub fn try_from_slice(bytes: &[u8]) -> Result<Self> {
        Ok(Self(bytes.try_into().map_err(|_| {
            Error::InvalidKeyLength {
                expected: Self::BYTES,
                actual: bytes.len(),
            }
        })?))
    }

    pub fn public_key(&self) -> PublicKey {
        let bytes = Kem::sk_to_pk(&self.hpke_key()).to_bytes();
        PublicKey(bytes.into())
    }

    pub fn as_bytes(&self) -> &[u8; Self::BYTES] {
        &self.0
    }

    fn hpke_key(&self) -> <Kem as HpkeKem>::PrivateKey {
        #[expect(
            clippy::expect_used,
            reason = "X-Wing accepts every 32-byte private key"
        )]
        <Kem as HpkeKem>::PrivateKey::from_bytes(&self.0)
            .expect("X-Wing accepts every 32-byte private key")
    }
}

impl std::fmt::Debug for SecretKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("SecretKey([REDACTED])")
    }
}

impl PartialEq for SecretKey {
    fn eq(&self, other: &Self) -> bool {
        self.0.ct_eq(&other.0).into()
    }
}

impl Eq for SecretKey {}

pub const OVERHEAD: usize = 1136;
const ENCAPSULATED_KEY_BYTES: usize = 1120;

pub fn seal(plaintext: &[u8], public_key: &PublicKey, info: &[u8]) -> Result<Vec<u8>> {
    let (encapped_key, ciphertext) = ::hpke::single_shot_seal::<Aead, Kdf, Kem>(
        &OpModeS::Base,
        &public_key.hpke_key(),
        info,
        plaintext,
        &[],
    )
    .map_err(|_| Error::EncryptionFailed)?;

    let mut sealed = encapped_key.to_bytes().to_vec();
    sealed.extend_from_slice(&ciphertext);
    Ok(sealed)
}

pub fn open(ciphertext: &[u8], secret_key: &SecretKey, info: &[u8]) -> Result<Vec<u8>> {
    if ciphertext.len() < OVERHEAD {
        return Err(Error::CiphertextTooShort {
            minimum: OVERHEAD,
            actual: ciphertext.len(),
        });
    }
    let (encapped_key, ciphertext) = ciphertext.split_at(ENCAPSULATED_KEY_BYTES);
    let encapped_key = <Kem as HpkeKem>::EncappedKey::from_bytes(encapped_key)
        .map_err(|_| Error::DecryptionFailed)?;

    ::hpke::single_shot_open::<Aead, Kdf, Kem>(
        &OpModeR::Base,
        &secret_key.hpke_key(),
        &encapped_key,
        info,
        ciphertext,
        &[],
    )
    .map_err(|_| Error::DecryptionFailed)
}

pub fn compute_commitment(user_id: i64, recovery_key: &[u8]) -> [u8; SHA512_BYTES] {
    let mut hasher = Sha512::new();
    hasher.update(COMMITMENT_DOMAIN_PREFIX.as_bytes());
    hasher.update(user_id.to_string().as_bytes());
    hasher.update(b"|");
    hasher.update(recovery_key);
    hasher.finalize().into()
}

pub fn public_key_fingerprint(public_key: &PublicKey) -> String {
    let digest: [u8; SHA512_BYTES] = Sha512::digest(public_key.as_bytes()).into();
    encode_hex(&digest)
}

pub fn compute_request_code(request_id: &str, device_public_key: &PublicKey) -> String {
    let mut hasher = Sha512::new();
    hasher.update(REQUEST_CODE_DOMAIN_PREFIX.as_bytes());
    hasher.update(request_id.as_bytes());
    hasher.update(b"|");
    hasher.update(device_public_key.as_bytes());
    let digest: [u8; SHA512_BYTES] = hasher.finalize().into();

    let raw_code = encode_base32_prefix(&digest);
    format!(
        "{}-{}-{}-{}",
        &raw_code[0..REQUEST_CODE_GROUP_LEN],
        &raw_code[REQUEST_CODE_GROUP_LEN..REQUEST_CODE_GROUP_LEN * 2],
        &raw_code[REQUEST_CODE_GROUP_LEN * 2..REQUEST_CODE_GROUP_LEN * 3],
        &raw_code[REQUEST_CODE_GROUP_LEN * 3..REQUEST_CODE_RAW_LEN],
    )
}

fn encode_hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        out.push(HEX_CHARS[(b >> 4) as usize] as char);
        out.push(HEX_CHARS[(b & 0x0f) as usize] as char);
    }
    out
}

fn encode_base32_prefix(digest: &[u8; SHA512_BYTES]) -> String {
    let mut out = String::with_capacity(BASE32_BLOCK_CHARS * 3);
    for chunk in digest[..BASE32_BLOCK_BYTES * 3].chunks_exact(BASE32_BLOCK_BYTES) {
        let value = ((chunk[0] as u64) << 32)
            | ((chunk[1] as u64) << 24)
            | ((chunk[2] as u64) << 16)
            | ((chunk[3] as u64) << 8)
            | (chunk[4] as u64);
        for step in (0..BASE32_BLOCK_CHARS).rev() {
            let idx = ((value >> (step * 5)) & 0x1f) as usize;
            out.push(BASE32_ALPHABET[idx] as char);
        }
    }
    out.truncate(REQUEST_CODE_RAW_LEN);
    out
}

#[cfg(test)]
mod tests {
    use base64::Engine;

    use super::*;

    const INFO: &[u8] = b"ente-test";

    #[test]
    fn seal_and_open() {
        let secret_key = SecretKey::generate();
        let public_key = secret_key.public_key();
        let plaintext = b"hello";

        let ciphertext = seal(plaintext, &public_key, INFO).unwrap();

        assert_eq!(ciphertext.len(), plaintext.len() + OVERHEAD);
        assert_ne!(ciphertext, seal(plaintext, &public_key, INFO).unwrap());
        assert_eq!(open(&ciphertext, &secret_key, INFO).unwrap(), plaintext);
        assert_eq!(
            SecretKey::try_from_slice(secret_key.as_bytes()).unwrap(),
            secret_key
        );
        assert_eq!(
            PublicKey::try_from_slice(public_key.as_bytes()).unwrap(),
            public_key
        );
    }

    #[test]
    fn authentication_failures() {
        let secret_key = SecretKey::generate();
        let ciphertext = seal(b"hello", &secret_key.public_key(), INFO).unwrap();

        assert!(open(&ciphertext, &SecretKey::generate(), INFO).is_err());
        assert!(open(&ciphertext, &secret_key, b"other-info").is_err());
        assert!(matches!(
            open(&ciphertext[..OVERHEAD - 1], &secret_key, INFO),
            Err(Error::CiphertextTooShort { .. })
        ));

        let mut corrupted = ciphertext;
        *corrupted.last_mut().unwrap() ^= 1;
        assert!(open(&corrupted, &secret_key, INFO).is_err());
    }

    #[test]
    fn opens_go_ciphertext() {
        // Generated with Go 1.26's crypto/hpke and private-key bytes 0..31.
        let secret_key = SecretKey::from_bytes(std::array::from_fn(|i| i as u8));
        let ciphertext = base64::engine::general_purpose::STANDARD
            .decode(include_str!("../../tests/data/hpke_go.sealed.b64").trim())
            .unwrap();

        assert_eq!(
            open(&ciphertext, &secret_key, b"ente-go-interop").unwrap(),
            b"sealed by Go"
        );
    }

    #[test]
    fn escrow_commitment_fingerprint_and_request_code_vectors() {
        let secret_key = SecretKey::from_bytes(std::array::from_fn(|i| i as u8));
        let public_key = secret_key.public_key();
        let recovery_key = [0x42u8; 32];

        let commitment = compute_commitment(1001, &recovery_key);
        assert_eq!(
            encode_hex(&commitment),
            "e246ec8d33414238c657066a04eb06ed9d5f9e03c63445ee31bf398d5f393fd252f32cf2ec04e1cf6ce2f778b9033ca8f2227ab3d341eaee5d194bcc5512f12f"
        );
        assert_ne!(commitment, compute_commitment(1002, &recovery_key));

        let fingerprint = public_key_fingerprint(&public_key);
        assert_eq!(
            fingerprint,
            "6ba5ba0db298b98ec2498a2e21ddfc79e7e29cb82f87a11f5bc300a3807c09bff43d429275e43e13be54e5c1d736df6b11a6c36f918ed23bf2537a693c1ed75c"
        );

        let request_code = compute_request_code(
            "550e8400-e29b-41d4-a716-446655440000",
            &public_key,
        );
        assert_eq!(request_code, "TUU2H-5AQV7-ASMSS-AD747");
        assert_ne!(
            request_code,
            compute_request_code("550e8400-e29b-41d4-a716-446655440001", &public_key)
        );
    }
}
