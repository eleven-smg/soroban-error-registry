use soroban_sdk::contracterror;

/// Errors returned by the example token contract.
///
/// Every code is explicit and unique, and the enum stays inside the 100-199
/// block reserved for the token contract, so a client can rely on
/// `102` always meaning `InsufficientBalance`.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TokenError {
    NotInitialized = 100,
    AlreadyInitialized = 101,
    InsufficientBalance = 102,
    InsufficientAllowance = 103,
    NegativeAmount = 104,
}
