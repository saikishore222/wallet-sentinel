export function isValidSolanaAddress(address: string): boolean {
  if (address.length < 32 || address.length > 44) {
    return false;
  }
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
}
