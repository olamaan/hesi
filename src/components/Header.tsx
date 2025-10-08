export default function Header() {
  return (
    <nav className="navbar navbar-expand-md navbar-language">
      <div className="container">
        <a className="navbar-brand" href="#">
          <img
            alt=""
            src="https://sdgs.un.org/themes/custom/porto/assets/images/home.svg"
          />{" "}
          Welcome to the United Nations
        </a>
        <button
          className="navbar-toggler blue"
          type="button"
          data-toggle="collapse"
          data-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded={false}
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse justify-content-end" id="navbarNav">
          <div className="row region region-language-menu">
            <div className="content">{/* Add language links if needed */}</div>
          </div>
        </div>
      </div>
    </nav>
  )
}
