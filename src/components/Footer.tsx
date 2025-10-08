export default function Footer() {
  return (
    <footer className="footer-dark mt-10">
      <div className="container">
        <div className="footer-social">
          <img
            src="https://sdgs.un.org/themes/custom/porto/assets/images/logo-footer-en.svg"
            alt="United Nations"
            className="footer__logo"
          />
          <div className="footer-actions">{/* Social icons if needed */}</div>
        </div>

        <div className="footer__links d-flex">
          <div className="row region region-bottom-footer">
            <h2 className="sr-only" id="block-porto-footer-menu">
              Footer menu
            </h2>
            <ul className="clearfix nav" aria-labelledby="block-porto-footer-menu">
              <li className="nav-item">
                <a className="nav-link" href="https://sdgs.un.org/contact">
                  Contact
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="https://www.un.org/en/sections/about-website/copyright/">
                  Copyright
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="https://www.un.org/en/sections/about-website/fraud-alert/">
                  Fraud Alert
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="https://www.un.org/en/sections/about-website/privacy-notice/">
                  Privacy Notice
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="https://www.un.org/en/sections/about-website/terms-use/">
                  Terms of Use
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  )
}
