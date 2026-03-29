import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { gsap } from 'gsap';
import { HiOutlineCube, HiOutlineShieldCheck, HiOutlineCloudArrowUp, HiOutlineDocumentCheck, HiOutlineHome, HiOutlineViewColumns } from 'react-icons/hi2';
import './Navbar.css';

const navLinks = [
  { path: '/', label: 'Home', icon: HiOutlineHome },
  { path: '/dashboard', label: 'Dashboard', icon: HiOutlineViewColumns },
  { path: '/upload', label: 'Upload', icon: HiOutlineCloudArrowUp },
  { path: '/issue', label: 'Issue', icon: HiOutlineDocumentCheck },
  { path: '/verify', label: 'Verify', icon: HiOutlineShieldCheck },
];

export default function Navbar() {
  const location = useLocation();
  const navRef = useRef(null);
  const logoRef = useRef(null);
  const linksRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        logoRef.current,
        { opacity: 0, x: -30 },
        { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out' }
      );
      gsap.fromTo(
        linksRef.current.children,
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power3.out', delay: 0.3 }
      );
    }, navRef);
    return () => ctx.revert();
  }, []);

  return (
    <nav className="navbar" ref={navRef}>
      <div className="navbar-inner container">
        <Link to="/" className="navbar-logo" ref={logoRef}>
          <HiOutlineCube className="logo-icon" />
          <span className="logo-text">Chain<span className="gradient-text">Locker</span></span>
        </Link>

        <div className="navbar-links" ref={linksRef}>
          {navLinks.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`nav-link ${location.pathname === path ? 'active' : ''}`}
            >
              <Icon className="nav-icon" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
