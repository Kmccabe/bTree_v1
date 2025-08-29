
import React, { useEffect, useState } from 'react'
import PeraWalletConnect from '@perawallet/connect'

const pera = new PeraWalletConnect()

export default function App() {
  const [account, setAccount] = useState<string | null>(null)
  const [network] = useState<string>(import.meta.env.VITE_NETWORK || 'TESTNET')

  useEffect(() => {
    pera.reconnectSession().then((accounts) => {
      if (accounts.length) setAccount(accounts[0])
      pera.on('disconnect', () => setAccount(null))
    })
  }, [])

  const handleConnect = async () => {
    try {
      const accounts = await pera.connect()
      setAccount(accounts[0])
    } catch (e) {
      console.error(e)
    }
  }

  const handleDisconnect = async () => {
    await pera.disconnect()
    setAccount(null)
  }

  return (
    <div style={{fontFamily: 'system-ui, Arial', padding: 24}}>
      <h1>Trust Game MVP</h1>
      <p><strong>Network:</strong> {network} (Pera supports TestNet; LocalNet is SDK/CI only)</p>

      {!account ? (
        <button onClick={handleConnect}>Connect Pera Wallet</button>
      ) : (
        <div>
          <p><strong>Connected:</strong> {account}</p>
          <button onClick={handleDisconnect}>Disconnect</button>
        </div>
      )}

      <hr />
      <p>Next: deploy contract skeleton and show app-id here.</p>
    </div>
  )
}
