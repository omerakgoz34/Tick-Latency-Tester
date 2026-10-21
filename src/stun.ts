const SERVERS = ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"];

export function measureStun(serverIndex: number, timeoutMs = 1600): Promise<number> {
  const urls = SERVERS[serverIndex % SERVERS.length];
  return new Promise((resolve, reject) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls }] });
    let settled = false;
    let t0 = performance.now();

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pc.onicecandidate = null;
      pc.close();
      fn();
    };

    const timer = setTimeout(() => finish(() => reject(new Error("timeout"))), timeoutMs);

    pc.onicecandidate = (ev) => {
      const candidate = ev.candidate;
      if (!candidate) return;
      const line = candidate.candidate;
      const typ = candidate.type;
      if (typ === "srflx" || line.includes(" typ srflx")) {
        finish(() => resolve(performance.now() - t0));
      }
    };

    pc.createDataChannel("t");
    pc.createOffer()
      .then((offer) => {
        t0 = performance.now();
        return pc.setLocalDescription(offer);
      })
      .catch((err: unknown) => finish(() => reject(err)));
  });
}
