pub fn is_valid_solana_address(address: &str) -> bool {
    match bs58::decode(address).into_vec() {
        Ok(bytes) => bytes.len() == 32,
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::is_valid_solana_address;

    #[test]
    fn accepts_system_program() {
        assert!(is_valid_solana_address("11111111111111111111111111111111"));
    }

    #[test]
    fn rejects_empty_and_garbage() {
        assert!(!is_valid_solana_address(""));
        assert!(!is_valid_solana_address("not-a-wallet"));
        assert!(!is_valid_solana_address("0OIl"));
    }
}
