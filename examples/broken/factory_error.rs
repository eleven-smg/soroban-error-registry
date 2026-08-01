use soroban_sdk::contracterror;

/// The factory contract claims the 300 block, which the router also uses.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum FactoryError {
    NotInitialized = 300,
    PairExists = 301,
    ZeroAddress = 302,
    InvalidFeeConfig = 303,
}
