# Telegram Wallet proposal fixtures

- `telegram-wallet-rev00.boc`: existing config[-123], matching the artifact at [10a0d2b](https://github.com/ton-blockchain/tg-wallet-contract/commit/10a0d2b9e87bd0a5e9135c2431e3eb15c6a0485c). Cell hash: `6f177fd863213d7bd3b24a694b0b7efb7425721ed1d21490d052ae93276c4406`.
- `telegram-wallet-key-rotation.boc`: payload read from mainnet `list_proposals` on 2026-09-29 for proposal `b2b46e5dba3272e93c0cd2a3c812f6767010b6c4e596d1e673b607b3364809d3`. Cell hash: `e30911420bef1191c09dce58b9df2b4ca4c2d9c383cc3b6a91170349ffa70e2c`.

The related [PR #4 commit](https://github.com/ton-blockchain/tg-wallet-contract/commit/355c5f3beb1f5129902c4a72e2cecaeac985af29) has a different BOC (`d80c7fd214b70a86c47668bf527b51234234ce48d352b1f04fde101575d0dc99`), reproduced with Acton 1.1.0-trunk (bb5933a), Tolk 1.4.2. Disassembly of the live payload shows the same rotation flow but uses 256-bit slices and event tag `0xeba19948`; the published commit uses uint256 and `0x5d1cd02f`. The dashboard therefore labels that link as a related commit, not an exact source match.
