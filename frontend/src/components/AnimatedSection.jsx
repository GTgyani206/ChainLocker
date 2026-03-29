import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function AnimatedSection({
  children,
  className = '',
  animation = 'fadeUp',
  delay = 0,
  duration = 0.8,
  stagger = 0.15,
  threshold = 0.2,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const animations = {
      fadeUp: { from: { opacity: 0, y: 60 }, to: { opacity: 1, y: 0 } },
      fadeDown: { from: { opacity: 0, y: -60 }, to: { opacity: 1, y: 0 } },
      fadeLeft: { from: { opacity: 0, x: -60 }, to: { opacity: 1, x: 0 } },
      fadeRight: { from: { opacity: 0, x: 60 }, to: { opacity: 1, x: 0 } },
      scale: { from: { opacity: 0, scale: 0.8 }, to: { opacity: 1, scale: 1 } },
      blur: { from: { opacity: 0, filter: 'blur(10px)' }, to: { opacity: 1, filter: 'blur(0px)' } },
    };

    const animConfig = animations[animation] || animations.fadeUp;
    const targets = el.children.length > 1 ? el.children : el;

    const ctx = gsap.context(() => {
      gsap.fromTo(targets, animConfig.from, {
        ...animConfig.to,
        duration,
        delay,
        stagger: el.children.length > 1 ? stagger : 0,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: `top ${100 - threshold * 100}%`,
          toggleActions: 'play none none none',
        },
      });
    });

    return () => ctx.revert();
  }, [animation, delay, duration, stagger, threshold]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
