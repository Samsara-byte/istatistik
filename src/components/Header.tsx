import { useEffect, useState } from 'react'

export default function Header() {
  const [dateStr, setDateStr] = useState('')
  useEffect(() => {
    setDateStr(new Date().toLocaleDateString('tr-TR', { day:'2-digit', month:'long', year:'numeric' }))
  }, [])
  return (
    <header>
      <div className="hlogo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="rgba(74,170,114,.25)" />
          <path d="M12 4c.5 0 3 2.5 3 6s-2.5 5-3 5-3-1-3-5 2.5-6 3-6z" fill="#4aaa72" />
          <path d="M5 12c0-.5 2.5-3 6-3s5 2.5 5 3-1 3-5 3-6-2.5-6-3z" fill="#4aaa72" opacity=".7" />
        </svg>
      </div>
      <div className="htxt">
        <div className="t1">T.C. Tarım ve Orman Bakanlığı</div>
        <div className="t2">Burdur İl Tarım ve Orman Müdürlüğü</div>
        <div className="t3">İl Tarımsal İstatistik Bilgi Sistemi</div>
      </div>
      <div className="h-right">
        <span className="hbadge">BURDUR</span>
        {dateStr && <span className="hdate">{dateStr}</span>}
      </div>
    </header>
  )
}
