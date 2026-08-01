use soroban_sdk::contracterror;

/// Deliberately broken sample used by the test suite and by CI.
///
/// It contains three separate problems:
///   * `PairNotFound` and `IdenticalAddresses` share code 300 (rustc E0081).
///   * Code 300 also belongs to `FactoryError` in the sibling file.
///   * `Unauthorized` has no explicit discriminant.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RouterError {
    NotInitialized = 200,
    DeadlineExpired = 201,
    InsufficientOutputAmount = 202,
    InvalidPath = 203,
    PairNotFound = 300,
    IdenticalAddresses = 300,
    Unauthorized,
}
