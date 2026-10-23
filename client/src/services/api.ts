const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://watchparty-server-ids7.onrender.com';

export async function pingServer(): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function createRoom(
  hostUsername?: string,
  initialVideoUrl?: string
): Promise<{ roomId: string }> {
  const res = await fetch(`${SERVER_URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostUsername, initialVideoUrl }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create room');
  }

  return res.json();
}

export async function checkRoomExists(roomIdOrCode: string): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(roomIdOrCode)}/exists`, {
      method: 'GET',
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.exists;
  } catch {
    return false;
  }
}
