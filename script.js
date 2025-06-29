// Camera System Application

// Global variables
var peer;
var conn;
var currentMode = 'client'; // 'client' (server) or 'camera'
var isConnected = false;
var viewId = '';
var cameraRole = 'front'; // 'front' or 'back'

// Camera streams
let cameraStream;

// Available devices
let videoDevices = [];

// Ping/Latency measurement
let lastPingTime = 0;
let currentLatency = 0;
let pingInterval;

// Connection tracking
let connectedCameras = {};

// DOM Elements - Mode Selection
const clientModeBtn = document.getElementById('client-mode-btn');
const cameraModeBtn = document.getElementById('camera-mode-btn');
const clientInterface = document.getElementById('client-interface');
const cameraInterface = document.getElementById('camera-interface');

// DOM Elements - Client Mode (Server)
const clientIdElement = document.getElementById('client-id');
const copyClientIdButton = document.getElementById('copy-client-id');
const generateNewIdButton = document.getElementById('generate-new-id');
const clientConnectionStatus = document.getElementById('client-connection-status');
const clientConnectionLatency = document.getElementById('client-connection-latency');
const connectedCamerasList = document.getElementById('connected-cameras-list');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const clientFrontView = document.getElementById('client-front-view');
const clientBackView = document.getElementById('client-back-view');

// DOM Elements - Camera Mode
const viewIdInput = document.getElementById('view-id-input');
const connectCameraBtn = document.getElementById('connect-camera-btn');
const cameraConnectionStatus = document.getElementById('camera-connection-status');
const cameraConnectionLatency = document.getElementById('camera-connection-latency');
const cameraPreview = document.getElementById('camera-preview');
const cameraSelect = document.getElementById('camera-select');
const frontCameraRoleBtn = document.getElementById('front-camera-role');
const backCameraRoleBtn = document.getElementById('back-camera-role');
const applyCameraSettingsButton = document.getElementById('apply-camera-settings');

// Permission Elements
const cameraPermissionOverlay = document.getElementById('camera-permission');
const grantPermissionBtn = document.getElementById('grant-permission');

// Initialize the application
async function initialize() {
  // Set up mode selection
  clientModeBtn.addEventListener('click', () => switchMode('client'));
  cameraModeBtn.addEventListener('click', () => switchMode('camera'));

  // Set up camera role selection
  frontCameraRoleBtn.addEventListener('click', () => setCameraRole('front'));
  backCameraRoleBtn.addEventListener('click', () => setCameraRole('back'));

  // Set up permission button
  grantPermissionBtn.addEventListener('click', async () => {
    try {
      await requestCameraPermission();
      cameraPermissionOverlay.classList.add('hidden');
    } catch (err) {
      console.error('Failed to get camera permission:', err);
      alert('Camera access is required for this application to work.');
    }
  });
  
  // Initialize based on default mode (client/server mode)
  if (currentMode === 'client') {
    initializeClientMode();
  }

  // Check camera permission
  checkCameraPermission();
}

// Check if we have camera permission
async function checkCameraPermission() {
  try {
    const result = await navigator.permissions.query({ name: 'camera' });
    if (result.state === 'granted') {
      cameraPermissionOverlay.classList.add('hidden');
    } else {
      cameraPermissionOverlay.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Failed to check camera permission:', err);
    cameraPermissionOverlay.classList.remove('hidden');
  }
}

// Request camera permission
async function requestCameraPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (err) {
    console.error('Failed to get camera permission:', err);
    throw err;
  }
}

// Switch between modes
function switchMode(mode) {
  currentMode = mode;

  // Update UI
  clientModeBtn.classList.remove('active');
  cameraModeBtn.classList.remove('active');
  clientInterface.classList.add('hidden');
  cameraInterface.classList.add('hidden');

  switch (mode) {
    case 'client':
      clientModeBtn.classList.add('active');
      clientInterface.classList.remove('hidden');
      initializeClientMode();
      break;
    case 'camera':
      cameraModeBtn.classList.add('active');
      cameraInterface.classList.remove('hidden');
      initializeCameraMode();
      break;
  }

  // Close existing connection when switching modes
  if (conn) {
    conn.close();
  }

  // Reset connection status
  isConnected = false;
  updateConnectionStatus();
}

// Set camera role (front or back)
function setCameraRole(role) {
  cameraRole = role;
  
  // Update UI
  frontCameraRoleBtn.classList.remove('active');
  backCameraRoleBtn.classList.remove('active');
  
  switch (role) {
    case 'front':
      frontCameraRoleBtn.classList.add('active');
      break;
    case 'back':
      backCameraRoleBtn.classList.add('active');
      break;
  }
}

// Generate a random ID for the view
function generateViewId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Initialize PeerJS for client mode (server)
function initializeClientMode() {
  // Generate a new view ID if we don't have one
  if (!viewId) {
    viewId = generateViewId();
  }

  // Initialize PeerJS with the view ID
  initializePeer('viewcal-' + viewId);

  // Display the view ID (without prefix)
  clientIdElement.textContent = viewId;

  // Set up event listeners for client mode
  copyClientIdButton.addEventListener('click', () => {
    navigator.clipboard
      .writeText(viewId)
      .then(() => {
        alert('View ID copied to clipboard');
      })
      .catch((err) => {
        console.error('Failed to copy:', err);
      });
  });

  generateNewIdButton.addEventListener('click', () => {
    // Generate a new ID
    viewId = generateViewId();
    clientIdElement.textContent = viewId;

    // Reinitialize peer with new ID
    initializePeer('viewcal-' + viewId);
    
    // Reset connected devices
    connectedCameras = {};
    updateConnectedCamerasList();
  });

  // Fullscreen button
  fullscreenBtn.addEventListener('click', toggleFullscreen);
}

// Initialize PeerJS for camera mode
async function initializeCameraStream() {
  try {
    if (cameraSelect.value) {
      const constraints = {
        video: {
          deviceId: { exact: cameraSelect.value }
        },
        audio: cameraRole === 'front' // Only include audio for front cam
      };

      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraPreview.srcObject = cameraStream;
    }
  } catch (err) {
    console.error('Failed to initialize camera:', err);
    alert('Failed to access camera: ' + err.message);
  }
}

// Initialize PeerJS
function initializePeer(specificId = null) {
  // Destroy existing peer if any
  if (peer) {
    peer.destroy();
  }

  // Create new peer
  if (specificId) {
    peer = new Peer(specificId, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      },
    });
  } else {
    peer = new Peer({
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      },
    });
  }

  // When peer is open
  peer.on('open', (id) => {
    console.log('My peer ID is: ' + id);
  });

  // Handle incoming connections
  peer.on('connection', (dataConnection) => {
    if (currentMode === 'client') {
      handleViewConnection(dataConnection);
    }
  });

  // Handle incoming calls
  peer.on('call', async (call) => {
    if (currentMode === 'client') {
      handleIncomingCall(call);
    }
  });

  // Handle errors
  peer.on('error', (err) => {
    console.error('PeerJS error:', err);
    handlePeerError(err);
  });
}

// Handle incoming call for view mode
async function handleIncomingCall(call) {
  try {
    // Answer with empty stream (we're just receiving)
    const emptyStream = createEmptyMediaStream();
    call.answer(emptyStream);
    
    // Get metadata
    const metadata = call.metadata || {};
    const cameraType = metadata.cameraType || 'unknown';
    
    // When we receive the stream
    call.on('stream', (stream) => {
      console.log(`Received ${cameraType} stream`);
      
      // Display the stream
      if (cameraType === 'front') {
        clientFrontView.srcObject = stream;
      } else if (cameraType === 'back') {
        clientBackView.srcObject = stream;
      }
    });
  } catch (err) {
    console.error('Failed to handle incoming call:', err);
  }
}

// Create empty media stream
function createEmptyMediaStream() {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.captureStream();
}

// Handle view connection (server mode)
function handleViewConnection(dataConnection) {
  const connectionId = dataConnection.peer;
  
  dataConnection.on('open', () => {
    console.log('New camera connection from:', connectionId);
    
    // Store the connection
    connectedCameras[connectionId] = {
      connection: dataConnection
    };
    
    // Update UI
    updateConnectedCamerasList();
    
    // Send acknowledgment
    dataConnection.send({
      type: 'connection-accepted'
    });
  });
  
  dataConnection.on('data', (data) => {
    handleIncomingData(data, dataConnection);
  });
  
  dataConnection.on('close', () => {
    console.log('Camera disconnected:', connectionId);
    delete connectedCameras[connectionId];
    updateConnectedCamerasList();
  });
}

// Connect to a view as a camera
function connectToView(viewId) {
  // Add prefix if not present
  const fullViewId = viewId.startsWith('viewcal-')
    ? viewId
    : 'viewcal-' + viewId;

  // Create connection
  const dataConnection = peer.connect(fullViewId);

  dataConnection.on('open', () => {
    conn = dataConnection;
    isConnected = true;
    updateConnectionStatus();
    
    // Start latency measurement
    startPingMeasurement();
    
    // Send camera stream
    sendCameraStream();
  });

  dataConnection.on('data', (data) => {
    handleIncomingData(data, dataConnection);
  });

  dataConnection.on('close', () => {
    conn = null;
    isConnected = false;
    updateConnectionStatus();
    clearInterval(pingInterval);
  });

  dataConnection.on('error', (err) => {
    console.error('Connection error:', err);
    cameraConnectionStatus.textContent = 'Error: ' + err;
  });
}

// Send camera stream
function sendCameraStream() {
  if (!isConnected || !conn || !cameraStream) {
    console.error('Cannot send camera stream: not connected or no stream');
    return;
  }
  
  console.log(`Sending ${cameraRole} camera stream`);
  
  const call = peer.call(conn.peer, cameraStream, {
    metadata: {
      cameraType: cameraRole,
      cameraPeerId: peer.id
    }
  });
  
  call.on('error', (err) => {
    console.error('Error sending camera stream:', err);
  });
}

// Get available cameras
async function getAvailableCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices = devices.filter(device => device.kind === 'videoinput');
    populateCameraSelects();
    await initializeCameraStream();
  } catch (err) {
    console.error('Failed to get cameras:', err);
    alert('Failed to access cameras: ' + err.message);
  }
}

// Populate camera selects
function populateCameraSelects() {
  cameraSelect.innerHTML = '<option value="">None</option>';
  videoDevices.forEach((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.text = device.label || `Camera ${index + 1}`;
    cameraSelect.appendChild(option);
  });
  if (videoDevices.length > 0) {
    cameraSelect.selectedIndex = 1;
  }
}

// Initialize camera stream
async function initializeCameraStream() {
  try {
    if (cameraSelect.value) {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: cameraSelect.value ? { exact: cameraSelect.value } : undefined
        }
      });
      cameraPreview.srcObject = cameraStream;
    }
  } catch (err) {
    console.error('Failed to initialize camera:', err);
    alert('Failed to access camera: ' + err.message);
  }
}

// Apply camera settings
async function applyCameraSettings() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  try {
    if (cameraSelect.value) {
      const constraints = {
        video: {
          deviceId: { exact: cameraSelect.value }
        },
        audio: cameraRole === 'front' // Only share mic when front cam is used
      };

      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraPreview.srcObject = cameraStream;

      if (isConnected && conn) {
        sendCameraStream();
      }
    }
  } catch (err) {
    console.error('Failed to apply camera settings:', err);
    alert('Failed to apply camera settings: ' + err.message);
  }
}

// Handle incoming data
function handleIncomingData(data, dataConnection) {
  if (data.type === 'ping') {
    dataConnection.send({
      type: 'pong',
      id: data.id,
      timestamp: data.timestamp
    });
  } else if (data.type === 'pong') {
    const now = Date.now();
    const pingTime = now - data.timestamp;
    currentLatency = pingTime;
    
    const latencyElement = currentMode === 'client' 
      ? clientConnectionLatency 
      : cameraConnectionLatency;
    
    if (latencyElement) {
      latencyElement.textContent = pingTime + ' ms';
    }
  }
}

// Start ping measurement
function startPingMeasurement() {
  if (pingInterval) {
    clearInterval(pingInterval);
  }

  pingInterval = setInterval(() => {
    if (isConnected && conn) {
      lastPingTime = Date.now();
      conn.send({
        type: 'ping',
        id: Math.random().toString(36).substring(2, 15),
        timestamp: lastPingTime
      });
    }
  }, 2000);
}

// Update connection status
function updateConnectionStatus() {
  const statusElement = currentMode === 'client' 
    ? clientConnectionStatus 
    : cameraConnectionStatus;
  
  const latencyElement = currentMode === 'client'
    ? clientConnectionLatency
    : cameraConnectionLatency;

  if (!statusElement || !latencyElement) return;

  if (isConnected) {
    statusElement.textContent = currentMode === 'client' 
      ? 'Connected' 
      : 'Connected to view';
    statusElement.classList.add('connected');
  } else {
    statusElement.textContent = currentMode === 'client'
      ? 'Waiting for cameras...'
      : 'Disconnected';
    statusElement.classList.remove('connected');
    latencyElement.textContent = '-- ms';
  }
}

// Update connected cameras list
function updateConnectedCamerasList() {
  if (Object.keys(connectedCameras).length === 0) {
    connectedCamerasList.innerHTML = '<li>No cameras connected</li>';
  } else {
    connectedCamerasList.innerHTML = '';
    Object.keys(connectedCameras).forEach(cameraPeerId => {
      const cameraItem = document.createElement('li');
      cameraItem.textContent = `Camera ${cameraPeerId.substring(0, 6)}...`;
      connectedCamerasList.appendChild(cameraItem);
    });
  }
}

// Toggle fullscreen
function toggleFullscreen() {
  const viewContainer = document.getElementById('client-view-container');

  if (!document.fullscreenElement) {
    if (viewContainer.requestFullscreen) {
      viewContainer.requestFullscreen();
    } else if (viewContainer.webkitRequestFullscreen) {
      viewContainer.webkitRequestFullscreen();
    } else if (viewContainer.msRequestFullscreen) {
      viewContainer.msRequestFullscreen();
    }

    fullscreenBtn.textContent = 'Exit Fullscreen';
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }

    viewContainer.classList.remove('fullscreen-mode');
    fullscreenBtn.textContent = 'Enter Fullscreen';
  }
}

document.addEventListener('fullscreenchange', (event) => {
  const viewContainer = document.getElementById('client-view-container');
  viewContainer.classList.toggle('fullscreen-mode');
});

// Handle peer errors
function handlePeerError(err) {
  let statusElement;
  switch (currentMode) {
    case 'client':
      statusElement = clientConnectionStatus;
      break;
    case 'camera':
      statusElement = cameraConnectionStatus;
      break;
  }
  
  if (statusElement) {
    statusElement.textContent = 'Error: ' + err.type;
  }

  // If the ID is already taken, generate a new one in client mode
  if (err.type === 'unavailable-id' && currentMode === 'client') {
    viewId = generateViewId();
    clientIdElement.textContent = viewId;
    initializePeer('viewcal-' + viewId);
  }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);
