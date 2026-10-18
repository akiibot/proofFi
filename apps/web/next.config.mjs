// Every pre-redesign URL still works: it lands on the screen that replaced it, keeping any query (?id=, ?amount=, …).
const moved = [
  ['/constitution', '/rules'],
  ['/workspace', '/ask'],
  ['/time-machine', '/ask'],
  ['/certificates', '/approve'],
  ['/red-team', '/security'],
  ['/audit', '/activity'],
  ['/certificate-verifier', '/activity/check'],
];

/** @type {import('next').NextConfig} */
const config = {
  async redirects() {
    return moved.map(([source, destination]) => ({ source, destination, permanent: false }));
  },
};

export default config;
