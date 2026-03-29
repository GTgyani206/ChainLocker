import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  HiOutlineCloudArrowUp,
  HiOutlineDocumentCheck,
  HiOutlineShieldCheck,
  HiOutlineFingerPrint,
  HiOutlineGlobeAlt,
  HiOutlineLockClosed,
} from 'react-icons/hi2';
import AnimatedSection from '../components/AnimatedSection';
import './Landing.css';

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: HiOutlineCloudArrowUp,
    title: 'IPFS Pinning',
    desc: 'Stream uploads to the InterPlanetary File System for permanent, censorship-resistant storage.',
    color: '#00d4aa',
  },
  {
    icon: HiOutlineFingerPrint,
    title: 'SHA-256 Hashing',
    desc: 'Incrementally compute cryptographic hashes during upload — zero extra passes needed.',
    color: '#06b6d4',
  },
  {
    icon: HiOutlineDocumentCheck,
    title: 'On-Chain Credentials',
    desc: 'Issue verifiable attestations on Solana using deterministic PDAs derived from document hashes.',
    color: '#7c3aed',
  },
  {
    icon: HiOutlineShieldCheck,
    title: 'Instant Verification',
    desc: 'Hash any document in-browser and verify its credential against the Solana ledger instantly.',
    color: '#3b82f6',
  },
  {
    icon: HiOutlineGlobeAlt,
    title: 'Edge-Native',
    desc: 'Designed to run on Raspberry Pi and edge nodes — lightweight, fast, and offline-resilient.',
    color: '#f59e0b',
  },
  {
    icon: HiOutlineLockClosed,
    title: 'Secure by Design',
    desc: 'Constant-time token validation, CSP headers, and minimal attack surface in production.',
    color: '#ef4444',
  },
];

const steps = [
  { num: '01', title: 'Upload', desc: 'Drop your document. It\'s hashed and pinned to IPFS in one shot.' },
  { num: '02', title: 'Issue', desc: 'Lock the credential on Solana. The PDA is derived deterministically.' },
  { num: '03', title: 'Verify', desc: 'Anyone can verify. Hash the file in-browser and check the ledger.' },
];

export default function Landing() {
  const heroRef = useRef(null);
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);
  const ctaRef = useRef(null);
  const particlesRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero entrance
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo(titleRef.current, { opacity: 0, y: 80, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 1.2 })
        .fromTo(subtitleRef.current, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8 }, '-=0.6')
        .fromTo(ctaRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.4');

      // Floating particles
      if (particlesRef.current) {
        const particles = particlesRef.current.children;
        Array.from(particles).forEach((p, i) => {
          gsap.to(p, {
            y: `random(-40, 40)`,
            x: `random(-20, 20)`,
            duration: `random(3, 6)`,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            delay: i * 0.3,
          });
        });
      }
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="landing-page">
      {/* Hero */}
      <section className="hero" ref={heroRef}>
        <div className="hero-bg-orbs">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>

        <div className="particles" ref={particlesRef}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="particle" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 6 + 2}px`,
              height: `${Math.random() * 6 + 2}px`,
              opacity: Math.random() * 0.5 + 0.1,
            }}></div>
          ))}
        </div>

        <div className="container hero-content">
          <h1 ref={titleRef} className="hero-title">
            Decentralized <span className="gradient-text">Credential</span><br />
            Issuance at the Edge
          </h1>
          <p ref={subtitleRef} className="hero-subtitle">
            Hash documents, pin to IPFS, and issue verifiable credentials on Solana — all from a single, lightweight edge node.
          </p>
          <div ref={ctaRef} className="hero-cta">
            <Link to="/dashboard" className="btn btn-primary btn-lg">
              Open Dashboard
            </Link>
            <Link to="/verify" className="btn btn-secondary btn-lg">
              Verify a Document
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section features-section">
        <div className="container">
          <AnimatedSection animation="fadeUp">
            <div className="section-header">
              <h2>Built for <span className="gradient-text">Trust</span></h2>
              <p>Every layer of ChainLocker is designed for cryptographic integrity and decentralized verification.</p>
            </div>
          </AnimatedSection>

          <AnimatedSection animation="fadeUp" className="grid-3" delay={0.2}>
            {features.map((f, i) => (
              <div key={i} className="feature-card glass-card">
                <div className="feature-icon" style={{ color: f.color, background: `${f.color}15` }}>
                  <f.icon />
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* How it works */}
      <section className="section how-section">
        <div className="container">
          <AnimatedSection animation="fadeUp">
            <div className="section-header">
              <h2>How it <span className="gradient-text">Works</span></h2>
              <p>Three steps from document to verifiable on-chain credential.</p>
            </div>
          </AnimatedSection>

          <AnimatedSection animation="fadeUp" className="steps-grid" delay={0.2}>
            {steps.map((s, i) => (
              <div key={i} className="step-card glass-card">
                <span className="step-num gradient-text">{s.num}</span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                {i < steps.length - 1 && <div className="step-connector"></div>}
              </div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* CTA */}
      <section className="section cta-section">
        <div className="container">
          <AnimatedSection animation="scale" className="cta-box glass-card">
            <h2>Ready to issue your first credential?</h2>
            <p>Connect your admin token, upload a document, and watch the magic happen.</p>
            <Link to="/upload" className="btn btn-primary btn-lg">
              Start Uploading
            </Link>
          </AnimatedSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container footer-inner">
          <p className="footer-brand gradient-text">ChainLocker</p>
          <p>Decentralized credential issuance. Open source. Edge-native.</p>
        </div>
      </footer>
    </div>
  );
}
