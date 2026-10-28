import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  Role,
  PublicParticipant,
  ActionRequest,
  ChatMessage,
  ReactionEvent,
  SyncStatePayload,
  ErrorEventPayload,
} from '../types/index.js';
import { getSocket, disconnectSocket, getMemoryReconnectToken, setMemoryReconnectToken } from '../services/socket.js';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'removed'
  | 'notFound'
  | 'wakingServer';

interface RoomContextType {
  connectionStatus: ConnectionStatus;
  syncState: SyncStatePayload | null;
  ownRole: Role;
  ownUserId: string | null;
  username: string;
  participants: PublicParticipant[];
  requests: ActionRequest[];
  chatMessages: ChatMessage[];
  reactions: ReactionEvent[];
  toastMessage: string | null;
  joinRoom: (roomId: string, username: string, avatar?: string) => void;
  leaveRoom: () => void;
  play: (currentTime?: number) => void;
  pause: (currentTime?: number) => void;
  seek: (targetTime: number) => void;
  changeVideo: (urlOrId: string) => void;
  assignRole: (targetUserId: string, newRole: Role) => void;
  removeParticipant: (targetUserId: string) => void;
  transferHost: (targetUserId: string) => void;
  requestAction: (actionType: 'PLAY' | 'PAUSE' | 'SEEK' | 'CHANGE_VIDEO', targetTime?: number, videoId?: string) => void;
  approveRequest: (requestId: string) => void;
  rejectRequest: (requestId: string) => void;
  sendMessage: (text: string) => void;
  sendReaction: (emoji: string) => void;
  clearToast: () => void;
  isScreenSharing: boolean;
  isLocalScreenShare: boolean;
  screenStream: MediaStream | null;
  startScreenShare: () => Promise<boolean>;
  stopScreenShare: () => void;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [syncState, setSyncState] = useState<SyncStatePayload | null>(null);
  const [ownRole, setOwnRole] = useState<Role>('PARTICIPANT');
  const [ownUserId, setOwnUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>(() => sessionStorage.getItem('wp_username') || '');
  const [participants, setParticipants] = useState<PublicParticipant[]>([]);
  const [requests, setRequests] = useState<ActionRequest[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Screen Sharing state & WebRTC refs
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [isLocalScreenShare, setIsLocalScreenShare] = useState<boolean>(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const viewerPcRef = useRef<RTCPeerConnection | null>(null);
  const screenShareHostUserIdRef = useRef<string | null>(null);

  const activeRoomIdRef = useRef<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  const stopScreenShare = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    peerConnectionsRef.current.forEach((pc) => {
      try { pc.close(); } catch {}
    });
    peerConnectionsRef.current.clear();

    if (viewerPcRef.current) {
      try { viewerPcRef.current.close(); } catch {}
      viewerPcRef.current = null;
    }

    setScreenStream(null);
    setIsScreenSharing(false);
    setIsLocalScreenShare(false);
    screenShareHostUserIdRef.current = null;

    const socket = getSocket();
    if (socket.connected) {
      socket.emit('screen_share_stopped');
    }
  }, []);

  const startScreenShare = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      showToast('Screen sharing is not supported on this device/browser');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          cursor: 'always',
        } as any,
        audio: true,
      });

      localStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);
      setIsLocalScreenShare(true);

      const socket = getSocket();
      socket.emit('screen_share_started');

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }
      showToast('Screen sharing started! All viewers can now see your screen.');
      return true;
    } catch (err) {
      if ((err as Error).name !== 'NotAllowedError') {
        showToast('Failed to start screen share: ' + (err as Error).message);
      }
      return false;
    }
  }, [showToast, stopScreenShare]);

  const joinRoom = useCallback((roomId: string, userDisplayName: string, userAvatar?: string) => {
    const socket = getSocket();
    activeRoomIdRef.current = roomId;
    setUsername(userDisplayName);
    sessionStorage.setItem('wp_username', userDisplayName);
    if (userAvatar) {
      sessionStorage.setItem('wp_avatar', userAvatar);
    }
    setConnectionStatus('connecting');

    if (!socket.connected) {
      socket.connect();
    }

    const reconnectToken = getMemoryReconnectToken() || sessionStorage.getItem('wp_reconnect_token') || undefined;
    const storedUserId = sessionStorage.getItem('wp_user_id') || undefined;
    const storedAvatar = userAvatar || sessionStorage.getItem('wp_avatar') || undefined;

    const emitJoin = () => {
      socket.emit('join_room', {
        roomId,
        username: userDisplayName,
        avatar: storedAvatar,
        userId: storedUserId,
        reconnectToken,
      });
    };

    if (socket.connected) {
      emitJoin();
    } else {
      socket.once('connect', emitJoin);
    }
  }, []);

  const leaveRoom = useCallback(() => {
    stopScreenShare();
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('leave_room');
    }
    disconnectSocket();
    sessionStorage.removeItem('wp_user_id');
    sessionStorage.removeItem('wp_reconnect_token');
    setSyncState(null);
    setParticipants([]);
    setRequests([]);
    setChatMessages([]);
    setReactions([]);
    setConnectionStatus('idle');
    activeRoomIdRef.current = null;
  }, [stopScreenShare]);

  // Socket event listeners
  useEffect(() => {
    const socket = getSocket();
    let isReconnecting = false;

    const handleConnect = () => {
      // Only emit on reconnect, not on initial connect (which joinRoom already handles)
      if (isReconnecting && activeRoomIdRef.current && username) {
        socket.emit('join_room', {
          roomId: activeRoomIdRef.current,
          username,
          avatar: sessionStorage.getItem('wp_avatar') || undefined,
          userId: sessionStorage.getItem('wp_user_id') || undefined,
          reconnectToken: getMemoryReconnectToken() || sessionStorage.getItem('wp_reconnect_token') || undefined,
        });
      }
      isReconnecting = true;
    };

    const handleDisconnect = () => {
      if (connectionStatus !== 'removed' && connectionStatus !== 'idle') {
        setConnectionStatus('disconnected');
      }
    };

    const handleSyncState = (data: SyncStatePayload) => {
      setSyncState(data);
      setConnectionStatus('connected');
      if (data.participants) {
        const seen = new Set<string>();
        const deduped: PublicParticipant[] = [];
        for (const p of data.participants) {
          if (!seen.has(p.userId)) {
            seen.add(p.userId);
            deduped.push(p);
          }
        }
        setParticipants(deduped);
      }
      if (data.requests) setRequests(data.requests);
      if (data.ownRole) setOwnRole(data.ownRole);
      if (data.ownUserId) {
        setOwnUserId(data.ownUserId);
        sessionStorage.setItem('wp_user_id', data.ownUserId);
      }
      if (data.reconnectToken) {
        setMemoryReconnectToken(data.reconnectToken);
        sessionStorage.setItem('wp_reconnect_token', data.reconnectToken);
      }
    };

    const handleUserJoined = (data: { user: PublicParticipant }) => {
      setParticipants((prev) => {
        const filtered = prev.filter((p) => p.userId !== data.user.userId);
        return [...filtered, data.user];
      });
      showToast(`${data.user.username} joined the room`);
    };

    const handleUserLeft = (data: { userId: string; username: string }) => {
      setParticipants((prev) => prev.filter((p) => p.userId !== data.userId));
      showToast(`${data.username} left the room`);
    };

    const handleRoleAssigned = (data: { targetUserId: string; role: Role }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.userId === data.targetUserId ? { ...p, role: data.role } : p))
      );
      if (ownUserId && data.targetUserId === ownUserId) {
        setOwnRole(data.role);
        showToast(`Your role changed to ${data.role}`);
      }
    };

    const handleParticipantRemoved = (data: { targetUserId: string }) => {
      setParticipants((prev) => prev.filter((p) => p.userId !== data.targetUserId));
    };

    const handleHostTransferred = (data: { newHostUserId: string }) => {
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.userId === data.newHostUserId) return { ...p, role: 'HOST' as Role };
          if (p.role === 'HOST') return { ...p, role: 'MODERATOR' as Role };
          return p;
        })
      );
      if (ownUserId && data.newHostUserId === ownUserId) {
        setOwnRole('HOST');
        showToast('You are now the Host of the room!');
      }
    };

    const handleActionRequested = (req: ActionRequest) => {
      setRequests((prev) => [...prev, req]);
      showToast(`${req.username} requested: ${req.actionType}`);
    };

    const handleActionRejected = (data: { requestId: string }) => {
      setRequests((prev) => prev.filter((r) => r.id !== data.requestId));
    };

    const handleChatMessage = (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev.slice(-150), msg]);
    };

    const handleChatHistory = (history: ChatMessage[]) => {
      setChatMessages(history);
    };

    const handleReaction = (rx: ReactionEvent) => {
      setReactions((prev) => [...prev.slice(-20), rx]);
      // Auto-clear reaction after 3 seconds
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.timestamp !== rx.timestamp));
      }, 3000);
    };

    const handleErrorEvent = (err: ErrorEventPayload) => {
      if (err.code === 'ROOM_NOT_FOUND') {
        setConnectionStatus('notFound');
      } else {
        showToast(err.message || 'An error occurred');
      }
    };

    const handleRemoved = (data: { message: string }) => {
      setConnectionStatus('removed');
      showToast(data.message || 'You have been removed from the room');
      disconnectSocket();
    };

    // 15-second heartbeat to keep connection alive through mobile lock/idle
    const heartbeatTimer = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat');
      }
    }, 15000);

    const handleScreenShareStarted = (data: { hostUserId: string; username: string }) => {
      screenShareHostUserIdRef.current = data.hostUserId;
      setIsScreenSharing(true);
      setIsLocalScreenShare(false);
      showToast(`${data.username} started sharing screen`);
      socket.emit('screen_share_request', { targetUserId: data.hostUserId });
    };

    const handleScreenShareStopped = () => {
      if (viewerPcRef.current) {
        try { viewerPcRef.current.close(); } catch {}
        viewerPcRef.current = null;
      }
      setScreenStream(null);
      setIsScreenSharing(false);
      setIsLocalScreenShare(false);
      screenShareHostUserIdRef.current = null;
      showToast('Screen sharing ended');
    };

    const handleScreenShareRequest = async (data: { fromUserId: string; fromUsername: string }) => {
      if (!localStreamRef.current) return;
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        peerConnectionsRef.current.set(data.fromUserId, pc);

        localStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => {
          pc.addTrack(track, localStreamRef.current!);
        });

        pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
          if (event.candidate) {
            socket.emit('webrtc_signal', {
              targetUserId: data.fromUserId,
              signal: { type: 'candidate', candidate: event.candidate },
            });
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc_signal', {
          targetUserId: data.fromUserId,
          signal: { type: 'offer', sdp: offer },
        });
      } catch (err) {
        console.warn('Error creating WebRTC offer:', err);
      }
    };

    const handleWebrtcSignal = async (data: { fromUserId: string; signal: any }) => {
      const { fromUserId, signal } = data;
      if (!signal) return;

      if (signal.type === 'offer') {
        try {
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
          });
          viewerPcRef.current = pc;

          pc.ontrack = (event: RTCTrackEvent) => {
            if (event.streams && event.streams[0]) {
              setScreenStream(event.streams[0]);
              setIsScreenSharing(true);
            }
          };

          pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
            if (event.candidate) {
              socket.emit('webrtc_signal', {
                targetUserId: fromUserId,
                signal: { type: 'candidate', candidate: event.candidate },
              });
            }
          };

          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc_signal', {
            targetUserId: fromUserId,
            signal: { type: 'answer', sdp: answer },
          });
        } catch (err) {
          console.warn('Error handling WebRTC offer:', err);
        }
      } else if (signal.type === 'answer') {
        const pc = peerConnectionsRef.current.get(fromUserId);
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          } catch (err) {
            console.warn('Error setting remote answer:', err);
          }
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        const pc = localStreamRef.current ? peerConnectionsRef.current.get(fromUserId) : viewerPcRef.current;
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (err) {
            // ignore
          }
        }
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('sync_state', handleSyncState);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);
    socket.on('role_assigned', handleRoleAssigned);
    socket.on('participant_removed', handleParticipantRemoved);
    socket.on('host_transferred', handleHostTransferred);
    socket.on('action_requested', handleActionRequested);
    socket.on('action_rejected', handleActionRejected);
    socket.on('chat_message', handleChatMessage);
    socket.on('chat_history', handleChatHistory);
    socket.on('reaction', handleReaction);
    socket.on('error_event', handleErrorEvent);
    socket.on('removed', handleRemoved);
    socket.on('screen_share_started', handleScreenShareStarted);
    socket.on('screen_share_stopped', handleScreenShareStopped);
    socket.on('screen_share_request', handleScreenShareRequest);
    socket.on('webrtc_signal', handleWebrtcSignal);

    return () => {
      clearInterval(heartbeatTimer);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('sync_state', handleSyncState);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
      socket.off('role_assigned', handleRoleAssigned);
      socket.off('participant_removed', handleParticipantRemoved);
      socket.off('host_transferred', handleHostTransferred);
      socket.off('action_requested', handleActionRequested);
      socket.off('action_rejected', handleActionRejected);
      socket.off('chat_message', handleChatMessage);
      socket.off('chat_history', handleChatHistory);
      socket.off('reaction', handleReaction);
      socket.off('error_event', handleErrorEvent);
      socket.off('removed', handleRemoved);
      socket.off('screen_share_started', handleScreenShareStarted);
      socket.off('screen_share_stopped', handleScreenShareStopped);
      socket.off('screen_share_request', handleScreenShareRequest);
      socket.off('webrtc_signal', handleWebrtcSignal);
    };
  }, [showToast, ownUserId, username, connectionStatus]);

  // Action dispatchers
  const play = useCallback((currentTime?: number) => {
    getSocket().emit('play', { currentTime });
  }, []);

  const pause = useCallback((currentTime?: number) => {
    getSocket().emit('pause', { currentTime });
  }, []);

  const seek = useCallback((targetTime: number) => {
    getSocket().emit('seek', { targetTime });
  }, []);

  const changeVideo = useCallback((urlOrId: string) => {
    getSocket().emit('change_video', { urlOrId });
  }, []);

  const assignRole = useCallback((targetUserId: string, newRole: Role) => {
    getSocket().emit('assign_role', { targetUserId, newRole });
  }, []);

  const removeParticipant = useCallback((targetUserId: string) => {
    getSocket().emit('remove_participant', { targetUserId });
  }, []);

  const transferHost = useCallback((targetUserId: string) => {
    getSocket().emit('transfer_host', { targetUserId });
  }, []);

  const requestAction = useCallback((
    actionType: 'PLAY' | 'PAUSE' | 'SEEK' | 'CHANGE_VIDEO',
    targetTime?: number,
    videoId?: string
  ) => {
    getSocket().emit('request_action', { actionType, targetTime, videoId });
    showToast(`Request sent to host: ${actionType}`);
  }, [showToast]);

  const approveRequest = useCallback((requestId: string) => {
    getSocket().emit('approve_request', { requestId });
  }, []);

  const rejectRequest = useCallback((requestId: string) => {
    getSocket().emit('reject_request', { requestId });
  }, []);

  const sendMessage = useCallback((text: string) => {
    getSocket().emit('chat_message', { text });
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    getSocket().emit('reaction', { emoji });
  }, []);

  return (
    <RoomContext.Provider
      value={{
        connectionStatus,
        syncState,
        ownRole,
        ownUserId,
        username,
        participants,
        requests,
        chatMessages,
        reactions,
        toastMessage,
        joinRoom,
        leaveRoom,
        play,
        pause,
        seek,
        changeVideo,
        assignRole,
        removeParticipant,
        transferHost,
        requestAction,
        approveRequest,
        rejectRequest,
        sendMessage,
        sendReaction,
        clearToast,
        isScreenSharing,
        isLocalScreenShare,
        screenStream,
        startScreenShare,
        stopScreenShare,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = (): RoomContextType => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
};
