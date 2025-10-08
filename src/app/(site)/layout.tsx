// src/app/(site)/layout.tsx
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />

      {/* Header Logo + Intro */}
      <div className="container">
        <a href="https://sdgs.un.org/">
        {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/desa_logo.svg" className="library_desa_logo" alt="UN DESA" />
        </a>

        <div className="library_accelerator_intro">
          <a href="https://sdgs.un.org">
            <button className="theme-chip" style={{ padding: '20px' }} title="SDGs.un.org">
              Return to UN DESA / SDGs.un.org
            </button>
          </a>
        </div>
      </div>

      <div id="platform_clear" />

      {/* Page Content */}
      <main className="container" style={{marginTop:30}}>{children}</main>

      <Footer />
    </>
  )
}
