import { copyFile, mkdir } from 'node:fs/promises'
await mkdir('public', { recursive: true })
await copyFile('core-rs/target/wasm32-unknown-unknown/release/ddg_core.wasm', 'public/ddg_core.wasm')
console.log('Rust kernel copied to public/ddg_core.wasm')
